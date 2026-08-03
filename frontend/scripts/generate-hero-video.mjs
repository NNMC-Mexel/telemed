/**
 * Builds the responsive hero video set from the master campus clip.
 *
 * The master is a 6.7 Mbit/s 720p grade — a mastering bitrate, not a web one.
 * Shipping it made the backdrop 93% of the landing page's weight and put it
 * ~90 s behind `load` on a 3G handset, so the hero never crossed over from the
 * poster before visitors gave up.
 *
 * Two things make aggressive encoding free here: the hero blurs the media by
 * 2px and lays a near-opaque scrim over it, so quantisation artefacts that
 * would be obvious on a showreel are invisible on screen. The clip is also
 * silent, so every rendition drops the (already absent) audio track outright.
 *
 * Outputs:
 *   public/nnmc-campus-hero-{640,1280}.mp4
 *
 * Run: npm run build:hero-video
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import ffmpeg from "ffmpeg-static";

const run = promisify(execFile);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const source = join(root, "assets-src", "nnmc-campus-hero-master.mp4");

// 640 covers every phone: the backdrop is blurred, so rendering it below the
// device pixel ratio costs nothing visible and keeps the mobile download in
// the same order of magnitude as the poster it replaces. 1280 is the master's
// native width — there is nothing to gain above it.
//
// Capped CRF rather than a fixed bitrate: the clip is a slow ambience pan, so
// constant quality spends bytes only on the few seconds that need them, while
// maxrate keeps the worst case inside the budget a phone can stream.
const RENDITIONS = [
    { width: 640, crf: 32, maxrate: "400k", bufsize: "800k", level: "3.1" },
    { width: 1280, crf: 30, maxrate: "1000k", bufsize: "2000k", level: "4.0" },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const mbps = (bytes, seconds) => `${((bytes * 8) / seconds / 1_000_000).toFixed(2)} Mbps`;

/** Reads the master's duration out of ffmpeg's banner — ffprobe is not bundled. */
async function probeDuration(file) {
    // ffmpeg exits non-zero when given no output; the banner still lands on stderr.
    const stderr = await run(ffmpeg, ["-hide_banner", "-i", file]).then(
        (result) => result.stderr,
        (error) => error.stderr ?? "",
    );
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (!match) throw new Error(`could not read duration from ${file}`);
    const [, hours, minutes, seconds] = match;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

async function main() {
    const duration = await probeDuration(source);
    const { size: sourceSize } = await stat(source);
    console.log(
        `source: ${duration.toFixed(2)}s (${kb(sourceSize)}, ${mbps(sourceSize, duration)})\n`,
    );

    for (const { width, crf, maxrate, bufsize, level } of RENDITIONS) {
        const out = join(publicDir, `nnmc-campus-hero-${width}.mp4`);
        await run(ffmpeg, [
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", source,
            // The master carries no audio track; -an keeps that true if it ever does.
            "-an",
            "-vf", `scale=${width}:-2:flags=lanczos`,
            "-c:v", "libx264",
            "-profile:v", "high",
            "-level:v", level,
            "-preset", "slow",
            "-crf", String(crf),
            "-maxrate", maxrate,
            "-bufsize", bufsize,
            // Safari refuses anything but 4:2:0 8-bit.
            "-pix_fmt", "yuv420p",
            // The hero loops, so keyframes every 2s keep the wrap-around cheap.
            "-g", "60",
            "-keyint_min", "60",
            "-sc_threshold", "0",
            // Moves the moov atom to the front so playback can start on the
            // first bytes instead of waiting for the whole file.
            "-movflags", "+faststart",
            out,
        ]);

        const { size } = await stat(out);
        console.log(
            `${width.toString().padStart(4)}px → ${kb(size).padStart(9)}` +
                ` (${mbps(size, duration)}, ${(sourceSize / size).toFixed(1)}x smaller)`,
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
