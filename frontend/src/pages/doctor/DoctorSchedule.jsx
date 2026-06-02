import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "../../components/ui/Toast";
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Save,
    Video,
    MessageCircle,
    Loader2,
    Calendar,
    Plus,
    Trash2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import useAuthStore from "../../stores/authStore";
import api, { normalizeResponse, getMediaUrl, getServerNow } from "../../services/api";
import {
    DEFAULT_WORKING_INTERVALS,
    generateSlotsFromIntervals,
    getDoctorWorkingIntervals,
    timeToMinutes,
    validateWorkingIntervals,
} from "../../utils/schedule";

// Генерируем все возможные временные слоты для выбора в настройках (каждые 30 минут)
const generateAllTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let min = 0; min < 60; min += 30) {
            const time = `${hour.toString().padStart(2, "0")}:${min
                .toString()
                .padStart(2, "0")}`;
            options.push({ value: time, label: time });
        }
    }
    return options;
};

const allTimeOptions = generateAllTimeOptions();

function DoctorSchedule() {
    const { t, i18n } = useTranslation()
    const dateLocale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru
    const { user } = useAuthStore();
    const toast = useToast();
    const [doctor, setDoctor] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [workingHours, setWorkingHours] = useState({
        slotDuration: 30,
    });
    const [workingIntervals, setWorkingIntervals] = useState(DEFAULT_WORKING_INTERVALS);
    const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);

    useEffect(() => {
        if (user?.id) {
            fetchDoctorAndAppointments();
        }
    }, [user?.id, currentDate]);

    const fetchDoctorAndAppointments = async () => {
        setIsLoading(true);
        try {
            let doctorRes = await api.get(
                `/api/doctors?filters[userId][$eq]=${user.id}&populate=*&pagination[limit]=1`
            );
            let doctorData = doctorRes.data?.data?.[0];

            console.log("Found doctor:", doctorData);
            setDoctor(doctorData);

            // Загружаем настройки расписания из профиля врача (если есть в Strapi)
            if (doctorData) {
                setWorkingHours({
                    slotDuration: doctorData.slotDuration || 30,
                });
                setWorkingIntervals(getDoctorWorkingIntervals(doctorData));

                // Загружаем рабочие дни (если есть в Strapi)
                if (doctorData.workingDays) {
                    const days =
                        typeof doctorData.workingDays === "string"
                            ? doctorData.workingDays
                                  .split(",")
                                  .map(Number)
                                  .filter((n) => !isNaN(n))
                            : doctorData.workingDays;
                    setWorkingDays(days);
                }
            }

            if (doctorData?.id) {
                // Получаем все записи и фильтруем на клиенте
                const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
                const weekEnd = addDays(weekStart, 7);

                const appointmentsRes = await api.get(`/api/appointments?populate=*&pagination[limit]=1000`);
                const { data: allAppointments } = normalizeResponse(appointmentsRes);
                
                // Фильтруем на клиенте по врачу и дате
                const doctorAppointments = (allAppointments || []).filter(apt => {
                    const matchesDoctor =
                        apt.doctor?.id === doctorData.id ||
                        (doctorData.documentId && apt.doctor?.documentId === doctorData.documentId);
                    if (!matchesDoctor) return false;
                    const aptDate = new Date(apt.dateTime);
                    return aptDate >= weekStart && aptDate < weekEnd;
                });
                
                console.log("Doctor appointments:", doctorAppointments);
                setAppointments(doctorAppointments);
            }
        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const goToPreviousWeek = () => setCurrentDate(addDays(currentDate, -7));
    const goToNextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    };

    const getAppointmentsForDate = (date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return appointments.filter((apt) => {
            const aptDate = format(new Date(apt.dateTime), "yyyy-MM-dd");
            return aptDate === dateStr;
        });
    };

    const isWorkingDay = (date) => workingDays.includes(date.getDay());

    const selectedAppointments = getAppointmentsForDate(selectedDate);

    // Генерируем слоты для отображения на основе текущих настроек
    const daySlots = generateSlotsFromIntervals(workingIntervals, workingHours.slotDuration)
        .map((time) => ({ time, isBreak: false }));

    const [isSaving, setIsSaving] = useState(false);

    const saveSettings = async () => {
        if (!doctor?.documentId) {
            toast.error(t('schedule.save_error_no_profile'));
            return;
        }

        const validation = validateWorkingIntervals(workingIntervals);
        if (validation.error) {
            const messages = {
                empty: "Добавьте хотя бы один рабочий интервал",
                invalid: "Проверьте время начала и конца интервалов",
                overlap: "Рабочие интервалы не должны пересекаться",
            };
            toast.error(messages[validation.error] || t('schedule.save_error'));
            return;
        }

        const normalizedIntervals = validation.intervals;
        const firstInterval = normalizedIntervals[0];
        const lastInterval = normalizedIntervals[normalizedIntervals.length - 1];
        const firstGap =
            normalizedIntervals.length > 1
                ? {
                      start: normalizedIntervals[0].end,
                      end: normalizedIntervals[1].start,
                  }
                : null;

        setIsSaving(true);
        try {
            console.log("Saving settings for doctor:", doctor.documentId, {
                workingIntervals: normalizedIntervals,
                workStartTime: firstInterval.start,
                workEndTime: lastInterval.end,
                slotDuration: workingHours.slotDuration,
                breakStart: firstGap?.start || "",
                breakEnd: firstGap?.end || "",
                workingDays: workingDays.join(","),
            });

            // Сохраняем настройки расписания в профиль врача (Strapi v5 использует documentId)
            const response = await api.put(`/api/doctors/${doctor.documentId}`, {
                data: {
                    workingIntervals: normalizedIntervals,
                    workStartTime: firstInterval.start,
                    workEndTime: lastInterval.end,
                    slotDuration: workingHours.slotDuration,
                    breakStart: firstGap?.start || "",
                    breakEnd: firstGap?.end || "",
                    workingDays: workingDays.join(","),
                },
            });

            console.log("Save response:", response.data);

            setShowSettingsModal(false);
            toast.success(t('schedule.save_success'));
            // Обновляем данные
            await fetchDoctorAndAppointments();
        } catch (error) {
            console.error(
                "Error saving settings:",
                error.response?.data || error
            );
            toast.error(
                t('schedule.save_error') + ": " +
                    (error.response?.data?.error?.message || error.message)
            );
        } finally {
            setIsSaving(false);
        }
    };

    const updateWorkingInterval = (index, field, value) => {
        setWorkingIntervals((prev) =>
            prev.map((interval, currentIndex) =>
                currentIndex === index
                    ? { ...interval, [field]: value }
                    : interval
            )
        );
    };

    const addWorkingInterval = () => {
        setWorkingIntervals((prev) => {
            const lastInterval = prev[prev.length - 1];
            const nextStart = lastInterval?.end || "09:00";
            const nextStartMinutes = timeToMinutes(nextStart) ?? 9 * 60;
            const nextEndMinutes = Math.min(nextStartMinutes + 60, 23 * 60 + 30);

            return [
                ...prev,
                {
                    start: nextStart,
                    end: nextEndMinutes > nextStartMinutes
                        ? `${String(Math.floor(nextEndMinutes / 60)).padStart(2, "0")}:${String(nextEndMinutes % 60).padStart(2, "0")}`
                        : "23:30",
                },
            ];
        });
    };

    const removeWorkingInterval = (index) => {
        setWorkingIntervals((prev) =>
            prev.length > 1 ? prev.filter((_, currentIndex) => currentIndex !== index) : prev
        );
    };

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
            </div>
        );
    }

    return (
        <div className='space-y-6 animate-fadeIn'>
            {/* Header */}
            <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-bold text-slate-900'>
                        {t('schedule.title')}
                    </h1>
                    <p className='text-slate-600'>
                        {t('schedule.subtitle')}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <Button variant='outline' onClick={goToToday}>
                        {t('schedule.today')}
                    </Button>
                    <Button
                        onClick={() => setShowSettingsModal(true)}
                        leftIcon={<Clock className='w-4 h-4' />}>
                        {t('schedule.settings_btn')}
                    </Button>
                </div>
            </div>

            {/* Week Navigation */}
            <Card>
                <CardContent className='py-4'>
                    <div className='flex items-center justify-between mb-4'>
                        <button
                            onClick={goToPreviousWeek}
                            className='p-2 hover:bg-slate-100 rounded-lg transition-colors'>
                            <ChevronLeft className='w-5 h-5' />
                        </button>
                        <h2 className='text-lg font-semibold text-slate-900'>
                            {format(weekStart, "d MMMM", { locale: dateLocale })} -{" "}
                            {format(addDays(weekStart, 6), "d MMMM yyyy", {
                                locale: dateLocale,
                            })}
                        </h2>
                        <button
                            onClick={goToNextWeek}
                            className='p-2 hover:bg-slate-100 rounded-lg transition-colors'>
                            <ChevronRight className='w-5 h-5' />
                        </button>
                    </div>

                    {/* Week Calendar */}
                    <div className='grid grid-cols-7 gap-1 sm:gap-2'>
                        {weekDays.map((day, index) => {
                            const dayAppointments = getAppointmentsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const isWorking = isWorkingDay(day);

                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(day)}
                                    className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl text-center transition-all ${
                                        isSelected
                                            ? "bg-teal-600 text-white"
                                            : isToday
                                            ? "bg-teal-50 text-teal-700"
                                            : isWorking
                                            ? "bg-white hover:bg-slate-50"
                                            : "bg-slate-100 text-slate-400"
                                    }`}>
                                    <p className='text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1'>
                                        {format(day, "EEEEEE", { locale: dateLocale })}
                                    </p>
                                    <p
                                        className={`text-base sm:text-lg font-bold ${
                                            isSelected ? "text-white" : ""
                                        }`}>
                                        {format(day, "d")}
                                    </p>
                                    {dayAppointments.length > 0 && (
                                        <div
                                            className={`mt-0.5 sm:mt-1 text-[10px] sm:text-xs leading-tight ${
                                                isSelected
                                                    ? "text-white/80"
                                                    : "text-teal-600"
                                            }`}>
                                            {dayAppointments.length}
                                            <span className='hidden sm:inline'>{" "}{dayAppointments.length === 1 ? t('schedule.apt_count_1') : t('schedule.apt_count_many')}</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className='grid lg:grid-cols-3 gap-6'>
                {/* Day Schedule */}
                <div className='lg:col-span-2'>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {format(selectedDate, "EEEE, d MMMM", {
                                    locale: dateLocale,
                                })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedAppointments.length === 0 &&
                            daySlots.length === 0 ? (
                                <div className='text-center py-12'>
                                    <Calendar className='w-12 h-12 mx-auto text-slate-300 mb-3' />
                                    <p className='text-slate-600'>
                                        {t('schedule.no_appointments')}
                                    </p>
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {daySlots.map(({ time, isBreak }) => {
                                        const appointment =
                                            selectedAppointments.find((a) => {
                                                const aptTime = format(
                                                    new Date(a.dateTime),
                                                    "HH:mm"
                                                );
                                                return aptTime === time;
                                            });

                                        return (
                                            <div
                                                key={time}
                                                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-xl min-w-0 ${
                                                    appointment
                                                        ? "bg-teal-50 border border-teal-200"
                                                        : isBreak
                                                        ? "bg-slate-100"
                                                        : "bg-slate-50 hover:bg-slate-100"
                                                }`}>
                                                <div className='w-full sm:w-16 text-center sm:text-center flex-shrink-0'>
                                                    <span className='font-medium text-slate-700 text-sm sm:text-base'>
                                                        {time}
                                                    </span>
                                                </div>
                                                <div className='hidden sm:block w-px h-8 bg-slate-200 flex-shrink-0' />
                                                {appointment ? (
                                                    <div className='flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0 w-full'>
                                                        <div className='flex items-center gap-2 sm:gap-3 min-w-0'>
                                                            <Avatar
                                                                src={getMediaUrl(
                                                                    appointment
                                                                        .patient
                                                                        ?.avatar
                                                                )}
                                                                name={
                                                                    appointment
                                                                        .patient
                                                                        ?.fullName ||
                                                                    t('schedule.patient_label')
                                                                }
                                                                size='sm'
                                                            />
                                                            <div className='min-w-0'>
                                                                <p className='font-medium text-slate-900 text-sm sm:text-base truncate'>
                                                                    {appointment
                                                                        .patient
                                                                        ?.fullName ||
                                                                        t('schedule.patient_label')}
                                                                </p>
                                                                <div className='flex items-center gap-1 text-xs text-slate-500'>
                                                                    {appointment.type ===
                                                                    "video" ? (
                                                                        <Video className='w-3 h-3' />
                                                                    ) : (
                                                                        <MessageCircle className='w-3 h-3' />
                                                                    )}
                                                                    <span className='hidden sm:inline'>{appointment.type === "video" ? t('schedule.type_video') : t('schedule.type_chat')}</span>
                                                                    <span className='sm:hidden'>{appointment.type === "video" ? t('schedule.type_video_short') : t('schedule.type_chat')}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className='flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end'>
                                                            {(() => {
                                                                const now = getServerNow();
                                                                const aptTime = new Date(appointment.dateTime);
                                                                const consultationDuration = doctor?.consultationDuration || doctor?.slotDuration || 30;
                                                                const bufferMinutes = 5;
                                                                const fifteenMinBefore = new Date(aptTime.getTime() - 15 * 60 * 1000);
                                                                const consultationEnd = new Date(aptTime.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000);
                                                                const appointmentStatus = appointment.statuse || appointment.status;
                                                                const canJoin = ['confirmed', 'pending'].includes(appointmentStatus) &&
                                                                    now >= fifteenMinBefore && now <= consultationEnd;
                                                                const isPast = now > consultationEnd || appointmentStatus === 'completed';

                                                                return (
                                                                    <>
                                                                        {isPast && appointmentStatus !== 'cancelled' ? (
                                                                            <Badge variant='success'>{t('schedule.status_completed')}</Badge>
                                                                        ) : (
                                                                            <Badge
                                                                                variant={
                                                                                    appointmentStatus === "confirmed"
                                                                                        ? "success"
                                                                                        : appointmentStatus === "pending"
                                                                                        ? "default"
                                                                                        : "danger"
                                                                                }>
                                                                                {appointmentStatus === "confirmed"
                                                                                    ? t('schedule.status_confirmed_short')
                                                                                    : appointmentStatus === "pending"
                                                                                    ? t('schedule.status_pending')
                                                                                    : t('schedule.status_cancelled')}
                                                                            </Badge>
                                                                        )}
                                                                        {canJoin && appointment.roomId && (
                                                                            <Link to={`/consultation/${appointment.roomId}`}>
                                                                                <Button size='sm'>{t('schedule.start_btn')}</Button>
                                                                            </Link>
                                                                        )}
                                                                        {isPast && appointmentStatus !== 'cancelled' && appointment.roomId && (
                                                                            <Link to={`/doctor/appointments/${appointment.documentId || appointment.id}`}>
                                                                                <Button size='sm' variant='secondary'>{t('schedule.details_btn')}</Button>
                                                                            </Link>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                ) : isBreak ? (
                                                    <span className='text-slate-400 w-full sm:w-auto'>
                                                        {t('schedule.break')}
                                                    </span>
                                                ) : (
                                                    <span className='text-slate-400 w-full sm:w-auto'>
                                                        {t('schedule.free')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Day Summary */}
                <div className='space-y-6'>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('schedule.day_stats')}</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.total_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {selectedAppointments.length}
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.video_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {
                                        selectedAppointments.filter(
                                            (a) => a.type === "video"
                                        ).length
                                    }
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    {t('schedule.chat_appointments')}
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {
                                        selectedAppointments.filter(
                                            (a) => a.type === "chat"
                                        ).length
                                    }
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-teal-50 rounded-xl'>
                                <span className='text-teal-700'>
                                    {t('schedule.potential_income')}
                                </span>
                                <span className='font-bold text-teal-700'>
                                    {selectedAppointments
                                        .reduce(
                                            (sum, a) =>
                                                sum +
                                                (a.price || doctor?.price || 0),
                                            0
                                        )
                                        .toLocaleString()}{" "}
                                    ₸
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('schedule.working_hours_title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='space-y-3 text-sm'>
                                {workingIntervals.map((interval, index) => (
                                    <div key={`${interval.start}-${interval.end}-${index}`} className='flex justify-between gap-3'>
                                        <span className='text-slate-600'>
                                            Интервал {index + 1}
                                        </span>
                                        <span className='font-medium text-right'>
                                            {interval.start} - {interval.end}
                                        </span>
                                    </div>
                                ))}
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        {t('schedule.slot_duration_label')}
                                    </span>
                                    <span className='font-medium'>
                                        {workingHours.slotDuration} {t('schedule.min_abbr')}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Settings Modal */}
            <Modal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                title={t('schedule.settings_modal_title')}
                size='md'
                footer={
                    <>
                        <Button
                            variant='secondary'
                            onClick={() => setShowSettingsModal(false)}
                            disabled={isSaving}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={saveSettings}
                            isLoading={isSaving}
                            leftIcon={<Save className='w-4 h-4' />}>
                            {t('common.save')}
                        </Button>
                    </>
                }>
                <div className='space-y-6'>
                    {/* Working Days */}
                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-2'>
                            {t('schedule.working_days')}
                        </label>
                        <div className='flex flex-wrap gap-2'>
                            {[t('schedule.day_mon'), t('schedule.day_tue'), t('schedule.day_wed'), t('schedule.day_thu'), t('schedule.day_fri'), t('schedule.day_sat'), t('schedule.day_sun')].map(
                                (day, index) => {
                                    const dayIndex =
                                        index === 6 ? 0 : index + 1;
                                    const isActive =
                                        workingDays.includes(dayIndex);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                setWorkingDays((prev) =>
                                                    isActive
                                                        ? prev.filter(
                                                              (d) =>
                                                                  d !== dayIndex
                                                          )
                                                        : [...prev, dayIndex]
                                                );
                                            }}
                                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                isActive
                                                    ? "bg-teal-600 text-white"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}>
                                            {day}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>

                    {/* Working Intervals */}
                    <div className='space-y-3'>
                        <div className='flex items-center justify-between gap-3'>
                            <label className='block text-sm font-medium text-slate-700'>
                                Рабочие интервалы
                            </label>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={addWorkingInterval}
                                leftIcon={<Plus className='w-4 h-4' />}>
                                Добавить
                            </Button>
                        </div>
                        <div className='space-y-3'>
                            {workingIntervals.map((interval, index) => (
                                <div
                                    key={`${index}-${interval.start}-${interval.end}`}
                                    className='grid grid-cols-[1fr_1fr_40px] gap-3 items-end'>
                                    <Select
                                        label={index === 0 ? t('schedule.select_start') : "Начало"}
                                        value={interval.start}
                                        onChange={(e) =>
                                            updateWorkingInterval(index, "start", e.target.value)
                                        }
                                        options={allTimeOptions}
                                    />
                                    <Select
                                        label={index === 0 ? t('schedule.select_end') : "Конец"}
                                        value={interval.end}
                                        onChange={(e) =>
                                            updateWorkingInterval(index, "end", e.target.value)
                                        }
                                        options={allTimeOptions}
                                    />
                                    <button
                                        type='button'
                                        title='Удалить интервал'
                                        aria-label='Удалить интервал'
                                        onClick={() => removeWorkingInterval(index)}
                                        disabled={workingIntervals.length === 1}
                                        className='h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors'>
                                        <Trash2 className='w-4 h-4' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Slot Duration */}
                    <Select
                        label={t('schedule.select_duration')}
                        value={workingHours.slotDuration.toString()}
                        onChange={(e) =>
                            setWorkingHours((prev) => ({
                                ...prev,
                                slotDuration: parseInt(e.target.value),
                            }))
                        }
                        options={[
                            { value: "15", label: t('schedule.min_15') },
                            { value: "30", label: t('schedule.min_30') },
                            { value: "45", label: t('schedule.min_45') },
                            { value: "60", label: t('schedule.min_60') },
                        ]}
                    />
                </div>
            </Modal>
        </div>
    );
}

export default DoctorSchedule;
