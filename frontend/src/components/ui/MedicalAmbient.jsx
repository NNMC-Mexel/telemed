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
    { x: "7%", y: "18%", size: "38px", duration: "31s", delay: "-8s", driftX: "10px", driftY: "-12px", rotation: "-8deg" },
    { x: "91%", y: "13%", size: "46px", duration: "37s", delay: "-21s", driftX: "-12px", driftY: "9px", rotation: "7deg" },
    { x: "12%", y: "72%", size: "52px", duration: "34s", delay: "-15s", driftX: "13px", driftY: "10px", rotation: "-5deg" },
    { x: "86%", y: "78%", size: "34px", duration: "29s", delay: "-4s", driftX: "-9px", driftY: "-13px", rotation: "9deg" },
    { x: "31%", y: "43%", size: "30px", duration: "27s", delay: "-18s", driftX: "8px", driftY: "12px", rotation: "-10deg" },
    { x: "69%", y: "37%", size: "42px", duration: "39s", delay: "-27s", driftX: "-11px", driftY: "-8px", rotation: "6deg" },
    { x: "52%", y: "88%", size: "36px", duration: "33s", delay: "-12s", driftX: "9px", driftY: "-10px", rotation: "-4deg" },
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
                            "--ambient-drift-x": item.driftX,
                            "--ambient-drift-y": item.driftY,
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
