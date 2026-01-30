import { useState, useEffect } from "react";
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
    },
    {
        id: "halyk",
        name: "Halyk Bank",
        icon: "🏛️",
        description: "Карта Halyk Bank",
    },
    {
        id: "card",
        name: "Банковская карта",
        icon: "💳",
        description: "Visa / Mastercard",
    },
];

// DEV MODE - симуляция оплаты в режиме разработки
const IS_DEV_MODE =
    import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === "true";

function BookingModal({ isOpen, onClose, doctor }) {
    const { user } = useAuthStore();
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

    const handleBook = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Перепроверяем занятые слоты перед бронированием
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            const freshBooked = await getBookedSlots(doctor.id, dateStr);
            setBookedSlots(freshBooked);

            if (freshBooked.includes(selectedTime)) {
                toast.error("К сожалению, выбранное время было забронировано другим пациентом. Пожалуйста, выберите другое свободное время.");
                setSelectedTime(null);
                setStep(1);
                setIsProcessing(false);
                return;
            }

            const dateTime = new Date(selectedDate);
            const [hours, minutes] = selectedTime.split(":");
            dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

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
                // Если время занято — сразу возвращаем на выбор времени
                if (msg.includes("забронировано") || msg.includes("занято")) {
                    // Добавляем слот в занятые, чтобы он исчез из списка
                    if (selectedTime) {
                        setBookedSlots(prev => [...prev, selectedTime]);
                    }
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

    const resetAndClose = () => {
        setStep(1);
        setSelectedDate(null);
        setSelectedTime(null);
        setConsultationType("video");
        setPaymentMethod(null);
        setIsComplete(false);
        setError(null);
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={resetAndClose}
            title={isComplete ? "Запись подтверждена!" : "Запись к врачу"}
            size='lg'>
            {isComplete ? (
                <div className='text-center py-8'>
                    <div className='w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6'>
                        <Check className='w-10 h-10 text-emerald-600' />
                    </div>
                    <h3 className='text-xl font-semibold text-slate-900 mb-2'>
                        Вы успешно записаны!
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
                    <div className='bg-slate-50 rounded-xl p-4 mb-6 text-left'>
                        <p className='text-sm text-slate-600 mb-2'>
                            📧 Подтверждение отправлено на вашу почту
                        </p>
                        <p className='text-sm text-slate-600 mb-2'>
                            📱 SMS-напоминание придёт за 30 минут до приёма
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
                    {/* Progress Steps - Compact for mobile */}
                    <div className='flex items-center justify-between mb-6 overflow-x-auto'>
                        {[
                            { num: 1, label: "Дата" },
                            { num: 2, label: "Тип" },
                            { num: 3, label: "Оплата" },
                            { num: 4, label: "Готово" },
                        ].map((s, i) => (
                            <div
                                key={s.num}
                                className='flex items-center flex-shrink-0'>
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                        step >= s.num
                                            ? "bg-teal-600 text-white"
                                            : "bg-slate-200 text-slate-500"
                                    )}>
                                    {step > s.num ? (
                                        <Check className='w-4 h-4' />
                                    ) : (
                                        s.num
                                    )}
                                </div>
                                <span
                                    className={cn(
                                        "ml-1 text-xs hidden sm:inline",
                                        step >= s.num
                                            ? "text-slate-900"
                                            : "text-slate-400"
                                    )}>
                                    {s.label}
                                </span>
                                {i < 3 && (
                                    <div
                                        className={cn(
                                            "w-4 sm:w-8 h-0.5 mx-1",
                                            step > s.num
                                                ? "bg-teal-600"
                                                : "bg-slate-200"
                                        )}
                                    />
                                )}
                            </div>
                        ))}
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
                                        <div className='grid grid-cols-4 sm:grid-cols-7 gap-2'>
                                            {availableSlots.map((time) => {
                                                const isSelected =
                                                    selectedTime === time;
                                                return (
                                                    <button
                                                        key={time}
                                                        onClick={() =>
                                                            setSelectedTime(
                                                                time
                                                            )
                                                        }
                                                        className={cn(
                                                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                                            isSelected
                                                                ? "bg-teal-600 text-white"
                                                                : "bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50"
                                                        )}>
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                        </div>
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

                            <button
                                onClick={() => setConsultationType("chat")}
                                className={cn(
                                    "w-full p-4 rounded-xl border-2 text-left transition-all",
                                    consultationType === "chat"
                                        ? "border-teal-600 bg-teal-50"
                                        : "border-slate-200 hover:border-slate-300"
                                )}>
                                <div className='flex flex-col sm:flex-row sm:items-center gap-4 min-w-0'>
                                    <div
                                        className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                            consultationType === "chat"
                                                ? "bg-teal-600 text-white"
                                                : "bg-slate-100 text-slate-600"
                                        )}>
                                        <MessageCircle className='w-6 h-6' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <h4 className='font-semibold text-slate-900'>
                                            Чат-консультация
                                        </h4>
                                        <p className='text-sm text-slate-500'>
                                            Переписка с врачом в течение дня
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 3: Payment */}
                    {step === 3 && (
                        <div className='space-y-4'>
                            <label className='block text-sm font-medium text-slate-700 mb-3'>
                                Способ оплаты
                            </label>

                            {/* DEV MODE Banner */}
                            {IS_DEV_MODE && (
                                <div className='p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4'>
                                    <p className='text-sm text-amber-800 flex items-center gap-2'>
                                        🧪 <strong>DEV MODE:</strong> Оплата
                                        симулируется, деньги не списываются
                                    </p>
                                </div>
                            )}

                            {paymentMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={cn(
                                        "w-full p-4 rounded-xl border-2 text-left transition-all",
                                        paymentMethod === method.id
                                            ? "border-teal-600 bg-teal-50"
                                            : "border-slate-200 hover:border-slate-300"
                                    )}>
                                    <div className='flex items-center gap-4'>
                                        <div className='text-3xl'>
                                            {method.icon}
                                        </div>
                                        <div>
                                            <h4 className='font-semibold text-slate-900'>
                                                {method.name}
                                            </h4>
                                            <p className='text-sm text-slate-500'>
                                                {method.description}
                                            </p>
                                        </div>
                                        {paymentMethod === method.id && (
                                            <Check className='w-5 h-5 text-teal-600 ml-auto' />
                                        )}
                                    </div>
                                </button>
                            ))}

                            <div className='mt-6 p-4 bg-slate-50 rounded-xl'>
                                <p className='text-sm text-slate-600'>
                                    💡 После оплаты запись будет подтверждена
                                    автоматически. Возврат средств возможен не
                                    позднее чем за 24 часа до приёма.
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

                    {/* Footer Actions */}
                    <div className='flex items-center justify-between mt-8 pt-4 border-t border-slate-100'>
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
                                rightIcon={
                                    <ChevronRight className='w-4 h-4' />
                                }>
                                Далее
                            </Button>
                        ) : (
                            <Button
                                onClick={handleBook}
                                isLoading={isProcessing}
                                leftIcon={<CreditCard className='w-4 h-4' />}>
                                Оплатить {formatPrice(doctorPrice)}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}

export default BookingModal;
