import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Save,
    Video,
    MessageCircle,
    Loader2,
    Calendar,
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
import { ru } from "date-fns/locale";
import useAuthStore from "../../stores/authStore";
import api, { normalizeResponse, getMediaUrl } from "../../services/api";

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

// Функция генерации слотов на основе рабочих часов
const generateWorkingSlots = (workingHours) => {
    const slots = [];
    const [startHour, startMin] = workingHours.startTime.split(":").map(Number);
    const [endHour, endMin] = workingHours.endTime.split(":").map(Number);
    const [breakStartHour, breakStartMin] = workingHours.breakStart
        .split(":")
        .map(Number);
    const [breakEndHour, breakEndMin] = workingHours.breakEnd
        .split(":")
        .map(Number);

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

        slots.push({ time: timeString, isBreak: isInBreak });

        // Добавляем интервал
        currentMin += workingHours.slotDuration;
        if (currentMin >= 60) {
            currentHour += Math.floor(currentMin / 60);
            currentMin = currentMin % 60;
        }
    }

    return slots;
};

function DoctorSchedule() {
    const { user } = useAuthStore();
    const [doctor, setDoctor] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [workingHours, setWorkingHours] = useState({
        startTime: "09:00",
        endTime: "18:00",
        slotDuration: 30,
        breakStart: "12:00",
        breakEnd: "14:00",
    });
    const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);

    useEffect(() => {
        if (user?.id) {
            fetchDoctorAndAppointments();
        }
    }, [user?.id, currentDate]);

    const fetchDoctorAndAppointments = async () => {
        setIsLoading(true);
        try {
            // Получаем всех врачей и ищем по userId на клиенте
            let doctorRes = await api.get(`/api/doctors?populate=*`);
            const allDoctors = doctorRes.data?.data || [];
            let doctorData = allDoctors.find(d => d.userId === user.id);

            // Если профиль врача не найден - создаём его автоматически
            if (!doctorData && user.userRole === 'doctor') {
                console.log("Creating doctor profile for user:", user.id);
                try {
                    const createRes = await api.post('/api/doctors', {
                        data: {
                            fullName: user.fullName || user.username || 'Врач',
                            users_permissions_user: user.id,
                            userId: user.id, // Добавляем поле для фильтрации
                            isActive: true,
                            rating: 0,
                            reviewsCount: 0,
                            price: 8000,
                            experience: 0,
                            workStartTime: '09:00',
                            workEndTime: '18:00',
                            breakStart: '12:00',
                            breakEnd: '14:00',
                            slotDuration: 30,
                            workingDays: '1,2,3,4,5',
                        }
                    });
                    doctorData = createRes.data?.data;
                    console.log("Doctor profile created:", doctorData);
                } catch (createError) {
                    console.error("Error creating doctor profile:", createError.response?.data || createError);
                }
            }

            console.log("Found doctor:", doctorData);
            setDoctor(doctorData);

            // Загружаем настройки расписания из профиля врача (если есть в Strapi)
            if (doctorData) {
                setWorkingHours({
                    startTime: doctorData.workStartTime || "09:00",
                    endTime: doctorData.workEndTime || "18:00",
                    slotDuration: doctorData.slotDuration || 30,
                    breakStart: doctorData.breakStart || "12:00",
                    breakEnd: doctorData.breakEnd || "14:00",
                });

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

                const appointmentsRes = await api.get(`/api/appointments?populate=*`);
                const { data: allAppointments } = normalizeResponse(appointmentsRes);
                
                // Фильтруем на клиенте по врачу и дате
                const doctorAppointments = (allAppointments || []).filter(apt => {
                    if (apt.doctor?.id !== doctorData.id) return false;
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

    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    const selectedAppointments = getAppointmentsForDate(selectedDate);

    // Генерируем слоты для отображения на основе текущих настроек
    const daySlots = generateWorkingSlots(workingHours);

    const [isSaving, setIsSaving] = useState(false);

    const saveSettings = async () => {
        if (!doctor?.documentId) {
            alert("Профиль врача не найден");
            return;
        }

        setIsSaving(true);
        try {
            console.log("Saving settings for doctor:", doctor.documentId, {
                workStartTime: workingHours.startTime,
                workEndTime: workingHours.endTime,
                slotDuration: workingHours.slotDuration,
                breakStart: workingHours.breakStart,
                breakEnd: workingHours.breakEnd,
                workingDays: workingDays.join(","),
            });

            // Сохраняем настройки расписания в профиль врача (Strapi v5 использует documentId)
            const response = await api.put(`/api/doctors/${doctor.documentId}`, {
                data: {
                    workStartTime: workingHours.startTime,
                    workEndTime: workingHours.endTime,
                    slotDuration: workingHours.slotDuration,
                    breakStart: workingHours.breakStart,
                    breakEnd: workingHours.breakEnd,
                    workingDays: workingDays.join(","),
                },
            });

            console.log("Save response:", response.data);

            setShowSettingsModal(false);
            alert("Настройки сохранены!");
            // Обновляем данные
            await fetchDoctorAndAppointments();
        } catch (error) {
            console.error(
                "Error saving settings:",
                error.response?.data || error
            );
            alert(
                "Ошибка сохранения настроек: " +
                    (error.response?.data?.error?.message || error.message)
            );
        } finally {
            setIsSaving(false);
        }
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
                        Расписание
                    </h1>
                    <p className='text-slate-600'>
                        Управление рабочим временем и записями
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <Button variant='outline' onClick={goToToday}>
                        Сегодня
                    </Button>
                    <Button
                        onClick={() => setShowSettingsModal(true)}
                        leftIcon={<Clock className='w-4 h-4' />}>
                        Настройки
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
                            {format(weekStart, "d MMMM", { locale: ru })} -{" "}
                            {format(addDays(weekStart, 6), "d MMMM yyyy", {
                                locale: ru,
                            })}
                        </h2>
                        <button
                            onClick={goToNextWeek}
                            className='p-2 hover:bg-slate-100 rounded-lg transition-colors'>
                            <ChevronRight className='w-5 h-5' />
                        </button>
                    </div>

                    {/* Week Calendar */}
                    <div className='grid grid-cols-7 gap-2'>
                        {weekDays.map((day, index) => {
                            const dayAppointments = getAppointmentsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const isWorking = isWorkingDay(day);

                            return (
                                <button
                                    key={index}
                                    onClick={() => setSelectedDate(day)}
                                    className={`p-3 rounded-xl text-center transition-all ${
                                        isSelected
                                            ? "bg-teal-600 text-white"
                                            : isToday
                                            ? "bg-teal-50 text-teal-700"
                                            : isWorking
                                            ? "bg-white hover:bg-slate-50"
                                            : "bg-slate-100 text-slate-400"
                                    }`}>
                                    <p className='text-xs font-medium mb-1'>
                                        {format(day, "EEE", { locale: ru })}
                                    </p>
                                    <p
                                        className={`text-lg font-bold ${
                                            isSelected ? "text-white" : ""
                                        }`}>
                                        {format(day, "d")}
                                    </p>
                                    {dayAppointments.length > 0 && (
                                        <div
                                            className={`mt-1 text-xs ${
                                                isSelected
                                                    ? "text-white/80"
                                                    : "text-slate-500"
                                            }`}>
                                            {dayAppointments.length}{" "}
                                            {dayAppointments.length === 1
                                                ? "запись"
                                                : "записей"}
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
                                    locale: ru,
                                })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedAppointments.length === 0 &&
                            daySlots.length === 0 ? (
                                <div className='text-center py-12'>
                                    <Calendar className='w-12 h-12 mx-auto text-slate-300 mb-3' />
                                    <p className='text-slate-600'>
                                        Нет записей на этот день
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
                                                className={`flex items-center gap-4 p-3 rounded-xl ${
                                                    appointment
                                                        ? "bg-teal-50 border border-teal-200"
                                                        : isBreak
                                                        ? "bg-slate-100"
                                                        : "bg-slate-50 hover:bg-slate-100"
                                                }`}>
                                                <div className='w-16 text-center'>
                                                    <span className='font-medium text-slate-700'>
                                                        {time}
                                                    </span>
                                                </div>
                                                <div className='w-px h-8 bg-slate-200' />
                                                {appointment ? (
                                                    <div className='flex-1 flex items-center justify-between'>
                                                        <div className='flex items-center gap-3'>
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
                                                                    "Пациент"
                                                                }
                                                                size='sm'
                                                            />
                                                            <div>
                                                                <p className='font-medium text-slate-900'>
                                                                    {appointment
                                                                        .patient
                                                                        ?.fullName ||
                                                                        "Пациент"}
                                                                </p>
                                                                <div className='flex items-center gap-1 text-xs text-slate-500'>
                                                                    {appointment.type ===
                                                                    "video" ? (
                                                                        <Video className='w-3 h-3' />
                                                                    ) : (
                                                                        <MessageCircle className='w-3 h-3' />
                                                                    )}
                                                                    {appointment.type ===
                                                                    "video"
                                                                        ? "Видеоконсультация"
                                                                        : "Чат"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className='flex items-center gap-2'>
                                                            <Badge
                                                                variant={
                                                                    appointment.status ===
                                                                    "confirmed"
                                                                        ? "success"
                                                                        : appointment.status ===
                                                                          "pending"
                                                                        ? "default"
                                                                        : "danger"
                                                                }>
                                                                {appointment.status ===
                                                                "confirmed"
                                                                    ? "Подтв."
                                                                    : appointment.status ===
                                                                      "pending"
                                                                    ? "Ожидает"
                                                                    : "Отменён"}
                                                            </Badge>
                                                            {appointment.roomId &&
                                                                appointment.status ===
                                                                    "confirmed" && (
                                                                    <Link
                                                                        to={`/consultation/${appointment.roomId}`}>
                                                                        <Button size='sm'>
                                                                            Начать
                                                                        </Button>
                                                                    </Link>
                                                                )}
                                                        </div>
                                                    </div>
                                                ) : isBreak ? (
                                                    <span className='text-slate-400'>
                                                        Перерыв
                                                    </span>
                                                ) : (
                                                    <span className='text-slate-400'>
                                                        Свободно
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
                            <CardTitle>Статистика дня</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    Всего записей
                                </span>
                                <span className='font-bold text-slate-900'>
                                    {selectedAppointments.length}
                                </span>
                            </div>
                            <div className='flex items-center justify-between p-3 bg-slate-50 rounded-xl'>
                                <span className='text-slate-600'>
                                    Видеоконсультации
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
                                    Чат-консультации
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
                                    Потенциальный доход
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
                            <CardTitle>Рабочие часы</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='space-y-3 text-sm'>
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        Начало работы
                                    </span>
                                    <span className='font-medium'>
                                        {workingHours.startTime}
                                    </span>
                                </div>
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        Конец работы
                                    </span>
                                    <span className='font-medium'>
                                        {workingHours.endTime}
                                    </span>
                                </div>
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        Перерыв
                                    </span>
                                    <span className='font-medium'>
                                        {workingHours.breakStart} -{" "}
                                        {workingHours.breakEnd}
                                    </span>
                                </div>
                                <div className='flex justify-between'>
                                    <span className='text-slate-600'>
                                        Длительность приёма
                                    </span>
                                    <span className='font-medium'>
                                        {workingHours.slotDuration} мин
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
                title='Настройки расписания'
                size='md'
                footer={
                    <>
                        <Button
                            variant='secondary'
                            onClick={() => setShowSettingsModal(false)}
                            disabled={isSaving}>
                            Отмена
                        </Button>
                        <Button
                            onClick={saveSettings}
                            isLoading={isSaving}
                            leftIcon={<Save className='w-4 h-4' />}>
                            Сохранить
                        </Button>
                    </>
                }>
                <div className='space-y-6'>
                    {/* Working Days */}
                    <div>
                        <label className='block text-sm font-medium text-slate-700 mb-2'>
                            Рабочие дни
                        </label>
                        <div className='flex flex-wrap gap-2'>
                            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(
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

                    {/* Working Hours */}
                    <div className='grid grid-cols-2 gap-4'>
                        <Select
                            label='Начало работы'
                            value={workingHours.startTime}
                            onChange={(e) =>
                                setWorkingHours((prev) => ({
                                    ...prev,
                                    startTime: e.target.value,
                                }))
                            }
                            options={allTimeOptions}
                        />
                        <Select
                            label='Конец работы'
                            value={workingHours.endTime}
                            onChange={(e) =>
                                setWorkingHours((prev) => ({
                                    ...prev,
                                    endTime: e.target.value,
                                }))
                            }
                            options={allTimeOptions}
                        />
                    </div>

                    {/* Break Time */}
                    <div className='grid grid-cols-2 gap-4'>
                        <Select
                            label='Начало перерыва'
                            value={workingHours.breakStart}
                            onChange={(e) =>
                                setWorkingHours((prev) => ({
                                    ...prev,
                                    breakStart: e.target.value,
                                }))
                            }
                            options={allTimeOptions}
                        />
                        <Select
                            label='Конец перерыва'
                            value={workingHours.breakEnd}
                            onChange={(e) =>
                                setWorkingHours((prev) => ({
                                    ...prev,
                                    breakEnd: e.target.value,
                                }))
                            }
                            options={allTimeOptions}
                        />
                    </div>

                    {/* Slot Duration */}
                    <Select
                        label='Длительность приёма'
                        value={workingHours.slotDuration.toString()}
                        onChange={(e) =>
                            setWorkingHours((prev) => ({
                                ...prev,
                                slotDuration: parseInt(e.target.value),
                            }))
                        }
                        options={[
                            { value: "15", label: "15 минут" },
                            { value: "30", label: "30 минут" },
                            { value: "45", label: "45 минут" },
                            { value: "60", label: "60 минут" },
                        ]}
                    />
                </div>
            </Modal>
        </div>
    );
}

export default DoctorSchedule;
