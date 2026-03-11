import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
    format,
    addDays,
    isSameDay,
    isToday,
    isBefore,
    startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
    Calendar,
    Clock,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Check,
    Video,
    MessageCircle,
    X,
    Lock,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";
import { cn, formatPrice } from "../../utils/helpers";
import { getMediaUrl, getBookedSlots } from "../../services/api";
import useAppointmentStore from "../../stores/appointmentStore";
import useAuthStore from "../../stores/authStore";
import { useToast } from "../ui/Toast";

// Функция генерации временных слотов на основе настроек врача
const generateTimeSlots = (doctor) => {
    // Берём настройки из профиля врача или используем дефолтные
    const workStartTime = doctor?.workStartTime || "09:00";
    const workEndTime = doctor?.workEndTime || "18:00";
    const slotDuration = doctor?.slotDuration || 30; // минуты
    const breakStart = doctor?.breakStart || "12:00";
    const breakEnd = doctor?.breakEnd || "14:00";

    const slots = [];
    const [startHour, startMin] = workStartTime.split(":").map(Number);
    const [endHour, endMin] = workEndTime.split(":").map(Number);
    const [breakStartHour, breakStartMin] = breakStart.split(":").map(Number);
    const [breakEndHour, breakEndMin] = breakEnd.split(":").map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (
        currentHour < endHour ||
        (currentHour === endHour && currentMin < endMin)
    ) {
        const timeString = `${currentHour
            .toString()
            .padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;

        // Проверяем, не попадает ли слот в перерыв
        const currentTotalMins = currentHour * 60 + currentMin;
        const breakStartMins = breakStartHour * 60 + breakStartMin;
        const breakEndMins = breakEndHour * 60 + breakEndMin;

        const isInBreak =
            currentTotalMins >= breakStartMins &&
            currentTotalMins < breakEndMins;

        if (!isInBreak) {
            slots.push(timeString);
        }

        // Добавляем интервал
        currentMin += slotDuration;
        if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60);
            currentMin = currentMin % 60;
        }
    }

    return slots;
};

// Функция фильтрации прошедших слотов для сегодняшнего дня
const filterPastSlots = (slots, selectedDate) => {
    if (!isToday(selectedDate)) {
        return slots; // Если не сегодня - показываем все слоты
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;

    return slots.filter((slot) => {
        const [slotHour, slotMin] = slot.split(":").map(Number);
        const slotTotalMins = slotHour * 60 + slotMin;
        // Показываем только слоты, которые начинаются позже текущего времени
        return slotTotalMins > currentTotalMins;
    });
};

const paymentMethods = [
    {
        id: "kaspi",
        name: "Kaspi QR",
        icon: "🏦",
        description: "Оплата через Kaspi.kz",
        badge: "Скоро",
        disabled: true,
    },
    {
        id: "halyk",
        name: "Halyk Bank",
        icon: "🏛️",
        description: "QR-оплата через Halyk Home Bank",
        badge: "Рекомендуем",
        disabled: false,
    },
    {
        id: "card",
        name: "Банковская карта",
        icon: "💳",
        description: "Visa / Mastercard · для международных платежей",
        badge: null,
        disabled: false,
    },
];

const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const SIGNALING_URL =
    import.meta.env.VITE_SIGNALING_SERVER || "http://localhost:1341";

// Load (or reload) ePay widget script — always fresh to avoid stale session state
const loadHalykScript = () =>
    new Promise((resolve, reject) => {
        // Remove previous script + state to avoid "payment expired" on re-attempts
        const prev = document.querySelector('script[src*="payment-api"]');
        if (prev) prev.remove();
        delete window.halyk;

        const isTest = import.meta.env.VITE_EPAY_TEST !== "false";
        const src = isTest
            ? "https://test-epay.epayment.kz/payform/payment-api.js"
            : "https://epay.homebank.kz/payform/payment-api.js";
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () =>
            reject(new Error("Не удалось загрузить платёжный модуль"));
        document.body.appendChild(script);
    });

function BookingModal({ isOpen, onClose, doctor }) {
    const { user, token } = useAuthStore();
    const { createAppointment, fetchTimeSlots, timeSlots } =
        useAppointmentStore();
    const toast = useToast();

    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [consultationType, setConsultationType] = useState("video");
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    // Halyk QR flow state
    const [halykQR, setHalykQR] = useState(null); // { qrcode, homebankLink, billNumber }
    const [halykQRStatus, setHalykQRStatus] = useState("pending"); // pending | paid | rejected | expired

    // Real-time slot reservations: Map<time, expiresAt>
    const [reservedByOthers, setReservedByOthers] = useState(new Map())
    const socketRef = useRef(null)

    // Countdown ticks to refresh remaining time labels
    const [, setTick] = useState(0)
    useEffect(() => {
        if (reservedByOthers.size === 0) return
        const id = setInterval(() => setTick(t => t + 1), 30000)
        return () => clearInterval(id)
    }, [reservedByOthers.size])

    const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
    
    // Получаем рабочие дни врача (по умолчанию Пн-Пт)
    const getWorkingDays = () => {
        if (doctor?.workingDays) {
            if (typeof doctor.workingDays === 'string') {
                return doctor.workingDays.split(',').map(Number).filter(n => !isNaN(n));
            }
            return doctor.workingDays;
        }
        return [1, 2, 3, 4, 5]; // Пн-Пт по умолчанию
    };
    
    const workingDays = getWorkingDays();
    const isWorkingDay = (date) => workingDays.includes(date.getDay());

    // Безопасное получение данных врача
    const doctorName = doctor?.fullName || doctor?.name || "Врач";
    const doctorSpecialization =
        typeof doctor?.specialization === "object"
            ? doctor?.specialization?.name
            : doctor?.specialization || "Специалист";
    const doctorPrice = doctor?.price || 0;

    useEffect(() => {
        const loadSlots = async () => {
        if (selectedDate && doctor?.id) {
                setIsLoadingSlots(true);
                try {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
                    // Загружаем временные слоты из базы (если есть)
            fetchTimeSlots(doctor.id, dateStr);
                    // Загружаем уже занятые слоты из записей
                    const booked = await getBookedSlots(doctor.id, dateStr);
                    setBookedSlots(booked);
                } catch (err) {
                    console.error("Error loading slots:", err);
                    setBookedSlots([]);
                } finally {
                    setIsLoadingSlots(false);
                }
            }
        };
        loadSlots();
    }, [selectedDate, doctor?.id, fetchTimeSlots]);

    // Socket: join slot-watch room when doctor + date are known, leave on cleanup
    useEffect(() => {
        if (!isOpen || !doctor?.id || !selectedDate) return

        const dateStr = format(selectedDate, "yyyy-MM-dd")

        const socket = io(SIGNALING_URL, { transports: ["websocket"] })
        socketRef.current = socket

        socket.emit("join-slot-watch", { doctorId: doctor.id, date: dateStr })

        socket.on("current-reservations", (reservations) => {
            const now = Date.now()
            const map = new Map()
            reservations.forEach(({ time, expiresAt }) => {
                if (expiresAt > now) map.set(time, expiresAt)
            })
            setReservedByOthers(map)
        })

        socket.on("slot-reserved", ({ time, expiresAt }) => {
            setReservedByOthers(prev => {
                const next = new Map(prev)
                next.set(time, expiresAt)
                return next
            })
        })

        socket.on("slot-released", ({ time }) => {
            setReservedByOthers(prev => {
                const next = new Map(prev)
                next.delete(time)
                return next
            })
        })

        return () => {
            socket.emit("leave-slot-watch", { doctorId: doctor.id, date: dateStr })
            socket.disconnect()
            socketRef.current = null
        }
    }, [isOpen, doctor?.id, selectedDate])

    // Emit reserve / release when selected time changes
    useEffect(() => {
        const socket = socketRef.current
        if (!socket || !doctor?.id || !selectedDate) return
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        if (selectedTime) {
            socket.emit("reserve-slot", {
                doctorId: doctor.id,
                date: dateStr,
                time: selectedTime,
                userId: user?.id,
            })
        }
        // release is handled server-side when a new reserve comes in from same socket
    }, [selectedTime])

    const getAvailableSlots = () => {
        if (!selectedDate) return [];

        let slots = [];

        // Если есть слоты из Strapi TimeSlot коллекции - используем их
        if (timeSlots && timeSlots.length > 0) {
            slots = timeSlots.map((slot) => slot.startTime || slot.time);
        } else {
        // Иначе генерируем слоты на основе настроек врача
            slots = generateTimeSlots(doctor);
        }

        // Фильтруем прошедшие слоты (для сегодня)
        slots = filterPastSlots(slots, selectedDate);
        
        // КРИТИЧНО: Фильтруем уже занятые слоты
        slots = slots.filter(slot => !bookedSlots.includes(slot));
        
        return slots;
    };

    const availableSlots = getAvailableSlots();

    const handleNext = () => {
        if (step < 4) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    // Shared: fresh slot check + build dateTime
    const verifySlotAndBuildDateTime = async () => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const freshBooked = await getBookedSlots(doctor.id, dateStr);
        setBookedSlots(freshBooked);

        if (freshBooked.includes(selectedTime)) {
            toast.error(
                "К сожалению, выбранное время было забронировано другим пациентом. Пожалуйста, выберите другое свободное время."
            );
            setSelectedTime(null);
            setStep(1);
            return null;
        }

        const dateTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(":");
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return dateTime;
    };

    // Kaspi: create appointment immediately, show instructions in success screen
    const handleKaspiPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) return;

            const result = await createAppointment({
                patient: user.id,
                doctor: doctor.id,
                dateTime: dateTime.toISOString(),
                type: consultationType,
                status: "pending",
                price: doctorPrice,
                paymentStatus: "pending",
                roomId: `room-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`,
            });

            if (result.success) {
                setIsComplete(true);
            } else {
                const msg = result.error || "Ошибка создания записи";
                toast.error(msg);
                setError(msg);
                if (msg.includes("забронировано") || msg.includes("занято")) {
                    setBookedSlots((prev) => [...prev, selectedTime]);
                    setSelectedTime(null);
                    setStep(1);
                }
            }
        } catch (err) {
            setError("Произошла ошибка. Попробуйте позже.");
        } finally {
            setIsProcessing(false);
        }
    };

    // ePay (Halyk/Card): redirect to ePay widget, appointment created on success page
    const handleEPayPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) {
                setIsProcessing(false);
                return;
            }

            // ePay requires numeric-only invoiceId (no letters/hyphens)
            const invoiceId = String(Date.now());
            const roomId = `room-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

            const successUrl = `${window.location.origin}/payment/success`;
            const failureUrl = `${window.location.origin}/payment/failure`;

            // Save booking data — appointment is created after ePay redirects back
            sessionStorage.setItem(
                "pendingBooking",
                JSON.stringify({
                    invoiceId,
                    roomId,
                    doctorId: doctor.id,
                    doctorName,
                    patientId: user.id,
                    dateTime: dateTime.toISOString(),
                    type: consultationType,
                    price: doctorPrice,
                    paymentMethod,
                })
            );

            // Get OAuth token from our backend (keeps ClientSecret server-side)
            const tokenRes = await fetch(
                `${SIGNALING_URL}/api/payment/epay-token`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        invoiceId,
                        amount: doctorPrice,
                    }),
                }
            );

            if (!tokenRes.ok) {
                const err = await tokenRes.json().catch(() => ({}));
                throw new Error(
                    err.error || "Не удалось инициализировать оплату"
                );
            }

            const { auth, terminalId } = await tokenRes.json();

            // Load ePay widget script
            await loadHalykScript();

            // Open ePay payment form — auth must be the full OAuth response object
            window.halyk.pay({
                auth,
                invoiceId,
                invoiceIdAlt: `${invoiceId}-alt`,
                amount: doctorPrice,
                currency: "KZT",
                terminal: terminalId,
                language: "RU",
                description: `Консультация у ${doctorName}`,
                accountId: String(user.id),
                name: user.fullName || user.username || "",
                email: user.email || "",
                phone: user.phone || "",
                backLink: successUrl,
                failureBackLink: failureUrl,
                postLink: "",
                failurePostLink: "",
            });
            // ePay now controls the page — no setIsProcessing(false) needed
        } catch (err) {
            console.error("ePay error:", err);
            setError(
                err.message ||
                    "Ошибка инициализации оплаты. Попробуйте другой способ."
            );
            setIsProcessing(false);
            sessionStorage.removeItem("pendingBooking");
        }
    };

    // Halyk Bank: uses official ePay QR by API for both mobile and desktop.
    // Mobile gets a "Open in Halyk" button (homebankLink deeplink).
    // Desktop shows a scannable QR code.
    // Both poll the server for payment status and create the appointment on PAID.
    const handleHalykPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) {
                setIsProcessing(false);
                return;
            }

            const roomId = `room-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

            const bookingData = {
                roomId,
                doctorId: doctor.id,
                doctorName,
                patientId: user.id,
                patientName: user.fullName || user.username || "",
                patientEmail: user.email || "",
                patientPhone: user.phone || "",
                dateTime: dateTime.toISOString(),
                type: consultationType,
                price: doctorPrice,
            };

            // Call server: get OAuth token + generate QR via ePay QR API
            const res = await fetch(
                `${SIGNALING_URL}/api/payment/create-halyk-qr`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingData, userToken: token }),
                }
            );

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Не удалось сгенерировать QR-код");
            }

            const { billNumber, qrcode, homebankLink } = await res.json();
            setHalykQR({ billNumber, qrcode, homebankLink });
            setHalykQRStatus("pending");

            // Start polling for payment status every 3 seconds
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(
                        `${SIGNALING_URL}/api/payment/halyk-qr-status/${billNumber}`
                    );
                    if (!statusRes.ok) {
                        clearInterval(pollInterval);
                        return;
                    }
                    const { status } = await statusRes.json();

                    if (status === "PAID") {
                        clearInterval(pollInterval);
                        setHalykQRStatus("paid");
                        // Give UI a moment then show success
                        setTimeout(() => {
                            setHalykQR(null);
                            setIsComplete(true);
                        }, 1500);
                    } else if (status === "REJECTED" || status === "CLOSED") {
                        clearInterval(pollInterval);
                        setHalykQRStatus("rejected");
                    }
                    // Other statuses (NEW, SCANNED, BLOCKED) → keep polling
                } catch {
                    // Network error during poll — ignore and retry
                }
            }, 3000);

            // Auto-expire after 20 minutes (ePay QR TTL)
            setTimeout(() => {
                clearInterval(pollInterval);
                setHalykQRStatus((s) =>
                    s === "pending" || s === "scanned" ? "expired" : s
                );
            }, 20 * 60 * 1000);
        } catch (err) {
            console.error("Halyk QR error:", err);
            setError(
                err.message ||
                    "Ошибка генерации QR-кода. Попробуйте другой способ."
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBook = () => {
        if (paymentMethod === "kaspi") {
            handleKaspiPayment();
        } else if (paymentMethod === "halyk") {
            handleHalykPayment();
        } else {
            handleEPayPayment();
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setSelectedDate(null);
        setSelectedTime(null);
        setConsultationType("video");
        setPaymentMethod(null);
        setIsComplete(false);
        setError(null);
        setHalykQR(null);
        setHalykQRStatus("pending");
        onClose();
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return selectedDate && selectedTime;
            case 2:
                return consultationType;
            case 3:
                return paymentMethod;
            default:
                return true;
        }
    };

    if (!doctor) return null;

    const footerButtons = !isComplete ? (
        <div className='flex items-center justify-between w-full'>
            <Button
                variant='ghost'
                onClick={step === 1 ? resetAndClose : handleBack}
                leftIcon={
                    step > 1 ? (
                        <ChevronLeft className='w-4 h-4' />
                    ) : undefined
                }>
                {step === 1 ? "Отмена" : "Назад"}
            </Button>

            {step < 4 ? (
                <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    rightIcon={<ChevronRight className='w-4 h-4' />}>
                    Далее
                </Button>
            ) : (
                <Button
                    onClick={handleBook}
                    isLoading={isProcessing}
                    leftIcon={<CreditCard className='w-4 h-4' />}>
                    {paymentMethod === "kaspi"
                        ? `Записаться · ${formatPrice(doctorPrice)}`
                        : paymentMethod === "halyk"
                        ? isMobileDevice()
                            ? `Открыть Halyk · ${formatPrice(doctorPrice)}`
                            : `Получить QR · ${formatPrice(doctorPrice)}`
                        : `Оплатить · ${formatPrice(doctorPrice)}`}
                </Button>
            )}
        </div>
    ) : undefined

    // Halyk QR modal — official ePay QR by API
    if (halykQR) {
        const isPaid = halykQRStatus === "paid";
        const isRejected = halykQRStatus === "rejected";
        const isExpired = halykQRStatus === "expired";
        const mobile = isMobileDevice();

        return (
            <Modal
                isOpen={isOpen}
                onClose={() => {
                    setHalykQR(null);
                    setHalykQRStatus("pending");
                }}
                title="Оплата через Halyk Bank"
                size="lg">
                <div className="flex flex-col items-center text-center py-4 space-y-5">
                    {isPaid ? (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    Оплата прошла!
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    Создаём вашу запись…
                                </p>
                            </div>
                        </>
                    ) : isRejected ? (
                        <>
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                                <X className="w-10 h-10 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    Оплата отклонена
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    Попробуйте снова или выберите другой способ.
                                </p>
                            </div>
                            <Button onClick={() => { setHalykQR(null); setHalykQRStatus("pending"); }}>
                                Попробовать снова
                            </Button>
                        </>
                    ) : isExpired ? (
                        <>
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">⏰</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    QR-код истёк
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    Время действия QR-кода (20 мин) вышло. Получите новый.
                                </p>
                            </div>
                            <Button onClick={() => { setHalykQR(null); setHalykQRStatus("pending"); }}>
                                Получить новый QR
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">🏛️</span>
                            </div>

                            {/* Mobile: show button to open Halyk app */}
                            {mobile && halykQR.homebankLink ? (
                                <div className="space-y-3 w-full max-w-xs">
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        Оплатите в Halyk Home Bank
                                    </h3>
                                    <a
                                        href={halykQR.homebankLink}
                                        className="block w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors">
                                        Открыть Halyk Home Bank
                                    </a>
                                    <p className="text-xs text-slate-400">
                                        После оплаты в приложении вернитесь сюда — запись создастся автоматически.
                                    </p>
                                </div>
                            ) : null}

                            {/* QR code — shown on desktop, or on mobile if no homebankLink */}
                            {(!mobile || !halykQR.homebankLink) && halykQR.qrcode && (
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                            Отсканируйте QR-код
                                        </h3>
                                        <p className="text-slate-500 text-sm">
                                            Откройте{" "}
                                            <strong>Halyk Home Bank</strong> →{" "}
                                            Платежи → Сканировать QR
                                        </p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200 inline-block">
                                        <QRCodeSVG
                                            value={halykQR.qrcode}
                                            size={200}
                                            bgColor="#ffffff"
                                            fgColor="#0f172a"
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Amount + polling indicator */}
                            <div className="bg-teal-50 rounded-xl px-4 py-3 text-sm text-teal-800 max-w-xs w-full">
                                <p className="font-semibold mb-1">
                                    К оплате: {formatPrice(doctorPrice)}
                                </p>
                                <div className="flex items-center justify-center gap-2 text-teal-600 mt-1">
                                    <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">Ожидаем оплату…</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setHalykQR(null);
                                    setHalykQRStatus("pending");
                                }}
                                className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                <X className="w-4 h-4" /> Выбрать другой способ оплаты
                            </button>
                        </>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={resetAndClose}
            title={isComplete ? "Запись подтверждена!" : "Запись к врачу"}
            size='lg'
            footer={footerButtons}>
            {isComplete ? (
                <div className='text-center py-8'>
                    <div className='w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6'>
                        <Check className='w-10 h-10 text-emerald-600' />
                    </div>
                    <h3 className='text-xl font-semibold text-slate-900 mb-2'>
                        Запись создана!
                    </h3>
                    <p className='text-slate-600 mb-6'>
                        Консультация с {doctorName}
                        <br />
                        {selectedDate &&
                            format(selectedDate, "d MMMM yyyy", {
                                locale: ru,
                            })}{" "}
                        в {selectedTime}
                    </p>

                    {/* Kaspi payment instructions */}
                    {paymentMethod === "kaspi" && (
                        <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left'>
                            <p className='text-sm font-semibold text-amber-900 mb-2'>
                                🏦 Оплата через Kaspi QR
                            </p>
                            <p className='text-sm text-amber-800 mb-1'>
                                Переведите{" "}
                                <strong>{formatPrice(doctorPrice)}</strong>{" "}
                                через Kaspi.kz на реквизиты клиники.
                            </p>
                            <p className='text-xs text-amber-700'>
                                После оплаты запись будет подтверждена
                                администратором в течение 30 минут.
                            </p>
                        </div>
                    )}

                    <div className='bg-slate-50 rounded-xl p-4 mb-6 text-left'>
                        <p className='text-sm text-slate-600 mb-2'>
                            📧 Подтверждение отправлено на вашу почту
                        </p>
                        <p className='text-sm text-slate-600'>
                            🔗 Ссылка на видеоконсультацию появится в личном
                            кабинете
                        </p>
                    </div>
                    <div className='flex gap-3 justify-center'>
                        <Button variant='outline' onClick={resetAndClose}>
                            Закрыть
                        </Button>
                        <Button
                            onClick={() =>
                                (window.location.href = "/patient/appointments")
                            }>
                            Мои записи
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Progress Steps */}
                    <div className='flex items-center mb-6'>
                        {[
                            { num: 1, label: "Дата" },
                            { num: 2, label: "Тип" },
                            { num: 3, label: "Оплата" },
                            { num: 4, label: "Готово" },
                        ].flatMap((s, i) => {
                            const items = [
                                <div key={s.num} className='flex flex-col items-center gap-1 shrink-0'>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                        step >= s.num
                                            ? "bg-teal-600 text-white"
                                            : "bg-slate-200 text-slate-500"
                                    )}>
                                        {step > s.num ? <Check className='w-4 h-4' /> : s.num}
                                    </div>
                                    <span className={cn(
                                        "text-xs",
                                        step >= s.num ? "text-slate-700" : "text-slate-400"
                                    )}>
                                        {s.label}
                                    </span>
                                </div>
                            ];
                            if (i < 3) {
                                items.push(
                                    <div key={`line-${i}`} className={cn(
                                        "flex-1 h-0.5 mb-4 transition-colors",
                                        step > s.num ? "bg-teal-600" : "bg-slate-200"
                                    )} />
                                );
                            }
                            return items;
                        })}
                    </div>

                    {error && (
                        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm'>
                            {error}
                        </div>
                    )}

                    {/* Doctor Info */}
                    <div className='flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50 rounded-xl mb-6 min-w-0'>
                        <Avatar
                            src={getMediaUrl(doctor.photo)}
                            name={doctorName}
                            size='lg'
                        />
                        <div className='min-w-0'>
                            <h3 className='font-semibold text-slate-900 break-words'>
                                {doctorName}
                            </h3>
                            <p className='text-sm text-teal-600'>
                                {doctorSpecialization}
                            </p>
                        </div>
                        <div className='sm:ml-auto sm:text-right w-full sm:w-auto'>
                            <p className='font-bold text-slate-900'>
                                {formatPrice(doctorPrice)}
                            </p>
                            <p className='text-xs text-slate-500'>
                                за консультацию
                            </p>
                        </div>
                    </div>

                    {/* Step 1: Date & Time */}
                    {step === 1 && (
                        <div className='space-y-6'>
                            <div>
                                <label className='block text-sm font-medium text-slate-700 mb-3'>
                                    Выберите дату
                                </label>
                                <div className='flex gap-2 overflow-x-auto pb-2'>
                                    {dates.map((date) => {
                                        const isSelected =
                                            selectedDate &&
                                            isSameDay(date, selectedDate);
                                        const isWorking = isWorkingDay(date);
                                        const isDisabled = !isWorking;
                                        return (
                                            <button
                                                key={date.toISOString()}
                                                onClick={() => {
                                                    if (!isDisabled) {
                                                    setSelectedDate(date);
                                                    setSelectedTime(null);
                                                        setBookedSlots([]); // Сбрасываем занятые слоты при смене даты
                                                    }
                                                }}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "flex-shrink-0 w-16 py-3 rounded-xl text-center transition-all",
                                                    isSelected
                                                        ? "bg-teal-600 text-white"
                                                        : isDisabled
                                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        : "bg-white border border-slate-200 hover:border-teal-500"
                                                )}>
                                                <div className='text-xs opacity-70'>
                                                    {format(date, "EEE", {
                                                        locale: ru,
                                                    })}
                                                </div>
                                                <div className='text-lg font-semibold'>
                                                    {format(date, "d")}
                                                </div>
                                                <div className='text-xs opacity-70'>
                                                    {format(date, "MMM", {
                                                        locale: ru,
                                                    })}
                                                </div>
                                                {isDisabled && (
                                                    <div className='text-[10px] text-slate-400'>
                                                        выходной
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedDate && (
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-3'>
                                        Выберите время
                                    </label>
                                    {isLoadingSlots ? (
                                        <div className='flex items-center justify-center py-8'>
                                            <div className='w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin'></div>
                                            <span className='ml-2 text-slate-500'>Загрузка слотов...</span>
                                        </div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className='text-center py-4'>
                                            <p className='text-slate-500'>
                                            Нет доступных слотов на эту дату
                                        </p>
                                            <p className='text-xs text-slate-400 mt-1'>
                                                Попробуйте выбрать другой день
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                        <div className='grid grid-cols-4 sm:grid-cols-7 gap-2'>
                                            {availableSlots.map((time) => {
                                                const isSelected = selectedTime === time;
                                                const heldExpiresAt = reservedByOthers.get(time);
                                                // Only treat as held-by-others if it's not our own selected slot
                                                const isHeld = !isSelected && !!heldExpiresAt && heldExpiresAt > Date.now();
                                                const minsLeft = isHeld ? Math.max(1, Math.ceil((heldExpiresAt - Date.now()) / 60000)) : 0;
                                                return (
                                                    <button
                                                        key={time}
                                                        onClick={() => !isHeld && setSelectedTime(time)}
                                                        disabled={isHeld}
                                                        title={isHeld ? `Кто-то выбирает этот слот (~${minsLeft} мин)` : undefined}
                                                        className={cn(
                                                            "py-2 px-1 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5",
                                                            isSelected
                                                                ? "bg-teal-600 text-white"
                                                                : isHeld
                                                                ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-not-allowed"
                                                                : "bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50"
                                                        )}>
                                                        {isHeld && <Lock className="w-3 h-3 opacity-70" />}
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {[...reservedByOthers.keys()].some(t => t !== selectedTime) && (
                                            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Слоты с замком временно заняты другим пользователем
                                            </p>
                                        )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Consultation Type */}
                    {step === 2 && (
                        <div className='space-y-4'>
                            <label className='block text-sm font-medium text-slate-700 mb-3'>
                                Тип консультации
                            </label>

                            <button
                                onClick={() => setConsultationType("video")}
                                className={cn(
                                    "w-full p-4 rounded-xl border-2 text-left transition-all",
                                    consultationType === "video"
                                        ? "border-teal-600 bg-teal-50"
                                        : "border-slate-200 hover:border-slate-300"
                                )}>
                                <div className='flex flex-col sm:flex-row sm:items-center gap-4 min-w-0'>
                                    <div
                                        className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                            consultationType === "video"
                                                ? "bg-teal-600 text-white"
                                                : "bg-slate-100 text-slate-600"
                                        )}>
                                        <Video className='w-6 h-6' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <h4 className='font-semibold text-slate-900'>
                                            Видеоконсультация
                                        </h4>
                                        <p className='text-sm text-slate-500'>
                                            Общение через видеосвязь в реальном
                                            времени
                                        </p>
                                    </div>
                                    <Badge variant='primary' className='self-start sm:self-auto'>
                                        Рекомендуем
                                    </Badge>
                                </div>
                            </button>

                            <div className='w-full p-4 rounded-xl border-2 border-slate-200 text-left opacity-50 cursor-not-allowed select-none'>
                                <div className='flex flex-col sm:flex-row sm:items-center gap-4 min-w-0'>
                                    <div className='w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-400'>
                                        <MessageCircle className='w-6 h-6' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <h4 className='font-semibold text-slate-400'>
                                            Чат-консультация
                                        </h4>
                                        <p className='text-sm text-slate-400'>
                                            Переписка с врачом в течение дня
                                        </p>
                                    </div>
                                    <span className='text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0'>
                                        В разработке
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment */}
                    {step === 3 && (
                        <div className='space-y-4'>
                            <label className='block text-sm font-medium text-slate-700 mb-3'>
                                Способ оплаты
                            </label>

                            {paymentMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => !method.disabled && setPaymentMethod(method.id)}
                                    disabled={method.disabled}
                                    className={cn(
                                        "w-full p-4 rounded-xl border-2 text-left transition-all",
                                        method.disabled
                                            ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                                            : paymentMethod === method.id
                                            ? "border-teal-600 bg-teal-50"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}>
                                    <div className='flex items-center gap-4'>
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl",
                                            method.disabled
                                                ? "bg-slate-100"
                                                : paymentMethod === method.id
                                                ? "bg-teal-100"
                                                : "bg-slate-100"
                                        )}>
                                            {method.icon}
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <h4 className={cn(
                                                    "font-semibold",
                                                    method.disabled ? "text-slate-400" : "text-slate-900"
                                                )}>
                                                    {method.name}
                                                </h4>
                                                {paymentMethod === method.id && !method.disabled && (
                                                    <Check className='w-5 h-5 text-teal-600 shrink-0' />
                                                )}
                                            </div>
                                            <p className={cn(
                                                "text-sm",
                                                method.disabled ? "text-slate-400" : "text-slate-500"
                                            )}>
                                                {method.id === "halyk"
                                                    ? isMobileDevice()
                                                        ? "QR-оплата · Halyk Home Bank"
                                                        : "QR-оплата · сканирование в приложении"
                                                    : method.description}
                                            </p>
                                            {method.badge && (
                                                <span className={cn(
                                                    "inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                                                    method.disabled
                                                        ? "text-slate-400 bg-slate-200"
                                                        : "text-teal-700 bg-teal-100"
                                                )}>
                                                    {method.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}

                            <div className='mt-2 p-4 bg-slate-50 rounded-xl'>
                                <p className='text-sm text-slate-600'>
                                    🔒 Оплата защищена шифрованием. Возврат
                                    средств возможен не позднее чем за 24 часа
                                    до приёма.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirmation */}
                    {step === 4 && (
                        <div className='space-y-4'>
                            <h3 className='font-semibold text-slate-900 mb-4'>
                                Проверьте данные записи
                            </h3>

                            <div className='bg-slate-50 rounded-xl divide-y divide-slate-200'>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>Врач</span>
                                    <span className='font-medium text-slate-900'>
                                        {doctorName}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>
                                        Специализация
                                    </span>
                                    <span className='font-medium text-slate-900'>
                                        {doctorSpecialization}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>Дата</span>
                                    <span className='font-medium text-slate-900'>
                                        {selectedDate &&
                                            format(
                                                selectedDate,
                                                "d MMMM yyyy",
                                                { locale: ru }
                                            )}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>
                                        Время
                                    </span>
                                    <span className='font-medium text-slate-900'>
                                        {selectedTime}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>Тип</span>
                                    <span className='font-medium text-slate-900'>
                                        {consultationType === "video"
                                            ? "Видеоконсультация"
                                            : "Чат-консультация"}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between'>
                                    <span className='text-slate-600'>
                                        Оплата
                                    </span>
                                    <span className='font-medium text-slate-900'>
                                        {
                                            paymentMethods.find(
                                                (m) => m.id === paymentMethod
                                            )?.name
                                        }
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between bg-teal-50'>
                                    <span className='font-semibold text-teal-700'>
                                        Итого к оплате
                                    </span>
                                    <span className='font-bold text-teal-700'>
                                        {formatPrice(doctorPrice)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}
        </Modal>
    );
}

export default BookingModal;
