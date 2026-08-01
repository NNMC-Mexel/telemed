import {
    Activity,
    CalendarDays,
    HeartPulse,
    Pill,
    Plus,
    ShieldCheck,
    Stethoscope,
} from "lucide-react";
import { cn } from "../../utils/helpers";

const ambientIcons = [Plus, HeartPulse, Stethoscope, ShieldCheck, Pill, Activity, CalendarDays];

// Fixed coordinates keep the composition stable between renders and avoid the
// visual jump that random client-side placement would create during hydration.
const ambientLayout = [
    {
        x: "7%", y: "18%", size: "38px", duration: "26s", delay: "-8s", rotation: "-8deg",
        pointA: ["30px", "-28px"], pointB: ["52px", "10px"], pointC: ["12px", "42px"],
    },
    {
        x: "91%", y: "13%", size: "46px", duration: "32s", delay: "-21s", rotation: "7deg",
        pointA: ["-34px", "30px"], pointB: ["-58px", "-8px"], pointC: ["-14px", "-45px"],
    },
    {
        x: "12%", y: "72%", size: "52px", duration: "29s", delay: "-15s", rotation: "-5deg",
        pointA: ["28px", "38px"], pointB: ["-18px", "56px"], pointC: ["-46px", "12px"],
    },
    {
        x: "86%", y: "78%", size: "34px", duration: "24s", delay: "-4s", rotation: "9deg",
        pointA: ["-32px", "-28px"], pointB: ["-52px", "22px"], pointC: ["-6px", "48px"],
    },
    {
        x: "31%", y: "43%", size: "30px", duration: "28s", delay: "-18s", rotation: "-10deg",
        pointA: ["24px", "-36px"], pointB: ["48px", "-2px"], pointC: ["10px", "40px"],
    },
    {
        x: "69%", y: "37%", size: "42px", duration: "34s", delay: "-27s", rotation: "6deg",
        pointA: ["-38px", "22px"], pointB: ["-8px", "52px"], pointC: ["42px", "14px"],
    },
    {
        x: "52%", y: "88%", size: "36px", duration: "30s", delay: "-12s", rotation: "-4deg",
        pointA: ["34px", "-30px"], pointB: ["-24px", "-50px"], pointC: ["-48px", "8px"],
    },
];

function MedicalAmbient({ tone = "brand", className }) {
    return (
        <div
            aria-hidden='true'
            className={cn("medical-ambient", `medical-ambient--${tone}`, className)}>
            {ambientLayout.map((item, index) => {
                const Icon = ambientIcons[index];

                return (
                    <span
                        key={index}
                        className='medical-ambient__item'
                        style={{
                            "--ambient-x": item.x,
                            "--ambient-y": item.y,
                            "--ambient-size": item.size,
                            "--ambient-duration": item.duration,
                            "--ambient-delay": item.delay,
                            "--ambient-a-x": item.pointA[0],
                            "--ambient-a-y": item.pointA[1],
                            "--ambient-b-x": item.pointB[0],
                            "--ambient-b-y": item.pointB[1],
                            "--ambient-c-x": item.pointC[0],
                            "--ambient-c-y": item.pointC[1],
                            "--ambient-rotation": item.rotation,
                        }}>
                        <Icon aria-hidden='true' strokeWidth={1.35} />
                    </span>
                );
            })}
        </div>
    );
}

export default MedicalAmbient;
