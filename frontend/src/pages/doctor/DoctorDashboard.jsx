import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Calendar,
    Clock,
    Video,
    Users,
    DollarSign,
    Star,
    ChevronRight,
    Loader2,
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
import useAuthStore from "../../stores/authStore";
import api, { normalizeResponse, getMediaUrl } from "../../services/api";
import {
    formatRelativeDate,
    formatPrice,
    formatDate,
} from "../../utils/helpers";

function DoctorDashboard() {
    const { user } = useAuthStore();
    const [doctor, setDoctor] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState({
        todayPatients: 0,
        monthlyEarnings: 0,
        rating: 0,
        monthlyConsultations: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            fetchDoctorData();
        }
    }, [user?.id]);

    const fetchDoctorData = async () => {
        try {
            // Получаем ВСЕХ врачей и фильтруем на клиенте по userId
            console.log("Fetching all doctors, looking for userId:", user.id);
            const doctorRes = await api.get(`/api/doctors?populate=*`);
            const allDoctors = doctorRes.data?.data || [];
            console.log("All doctors:", allDoctors);

            // Ищем врача по userId
            const doctorData = allDoctors.find((d) => d.userId === user.id);
            console.log("Found doctor for userId", user.id, ":", doctorData);
            setDoctor(doctorData);

            if (doctorData?.id) {
                const today = new Date().toISOString().split("T")[0];

                // Получаем ВСЕ записи и фильтруем на клиенте
                const appointmentsRes = await api.get(
                    `/api/appointments?populate=*`,
                );
                console.log("All appointments response:", appointmentsRes.data);

                const { data: allAppointments } =
                    normalizeResponse(appointmentsRes);

                // Фильтруем записи для этого врача
                const doctorAppointments = (allAppointments || []).filter(
                    (apt) => {
                        return (
                            apt.doctor?.id === doctorData.id ||
                            (doctorData.documentId &&
                                apt.doctor?.documentId ===
                                    doctorData.documentId)
                        );
                    },
                );
                console.log("Doctor appointments:", doctorAppointments);

                setAppointments(doctorAppointments);

                // Получаем отзывы (все, фильтруем на клиенте)
                const reviewsRes = await api.get(`/api/reviews?populate=*`);
                const { data: allReviews } = normalizeResponse(reviewsRes);
                const allDoctorReviews = (allReviews || [])
                    .filter((r) => r.doctor?.id === doctorData.id);
                const doctorReviews = allDoctorReviews.slice(0, 5);
                setReviews(doctorReviews);

                // Вычисляем рейтинг из реальных отзывов
                const computedRating = allDoctorReviews.length > 0
                    ? allDoctorReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allDoctorReviews.length
                    : 0;

                // Подсчитываем статистику на основе уже полученных данных
                const todayStr = today;
                const todayAppts = doctorAppointments.filter((a) => {
                    const aptDate = new Date(a.dateTime)
                        .toISOString()
                        .split("T")[0];
                    return aptDate === todayStr && (a.statuse || a.status) === "confirmed";
                });

                // Месячная статистика
                const monthStart = new Date();
                monthStart.setDate(1);
                const monthlyCompleted = doctorAppointments.filter((a) => {
                    const aptDate = new Date(a.dateTime);
                    return aptDate >= monthStart && (a.statuse || a.status) === "completed";
                });

                const monthlyEarnings = monthlyCompleted.reduce(
                    (sum, a) => sum + (a.price || doctorData.price || 0),
                    0,
                );

                setStats({
                    todayPatients: todayAppts.length,
                    monthlyEarnings,
                    rating: computedRating,
                    monthlyConsultations: monthlyCompleted.length,
                });
            }
        } catch (error) {
            console.error("Error fetching doctor data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "completed":
                return <Badge variant='success'>Завершён</Badge>;
            case "confirmed":
                return <Badge variant='primary'>Подтверждён</Badge>;
            case "pending":
                return <Badge variant='warning'>Ожидает</Badge>;
            case "cancelled":
                return <Badge variant='danger'>Отменён</Badge>;
            default:
                return null;
        }
    };

    const todayAppointments = appointments.filter((a) => {
        const today = new Date().toISOString().split("T")[0];
        const aptDate = new Date(a.dateTime).toISOString().split("T")[0];
        return aptDate === today;
    });

    const nextAppointment = appointments.find(
        (a) => (a.statuse || a.status) === "confirmed" && new Date(a.dateTime) > new Date(),
    );

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
            </div>
        );
    }

    return (
        <div className='space-y-6 animate-fadeIn'>
            {/* Welcome */}
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-2xl font-bold text-slate-900'>
                        Добрый день, {user?.fullName?.split(" ")[1] || "Доктор"}
                        ! 👨‍⚕️
                    </h1>
                    <p className='text-slate-600 mt-1'>
                        У вас сегодня {stats.todayPatients}{" "}
                        {stats.todayPatients === 1 ? "запись" : "записей"}
                    </p>
                </div>
                <Link to='/doctor/schedule'>
                    <Button rightIcon={<ChevronRight className='w-4 h-4' />}>
                        Расписание
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
                <Card>
                    <CardContent>
                        <div className='flex items-center justify-between mb-2'>
                            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center'>
                                <Users className='w-5 h-5 text-white' />
                            </div>
                        </div>
                        <p className='text-2xl font-bold text-slate-900'>
                            {stats.todayPatients}
                        </p>
                        <p className='text-sm text-slate-500'>
                            Пациентов сегодня
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <div className='flex items-center justify-between mb-2'>
                            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                                <DollarSign className='w-5 h-5 text-white' />
                            </div>
                        </div>
                        <p className='text-2xl font-bold text-slate-900'>
                            {formatPrice(stats.monthlyEarnings)}
                        </p>
                        <p className='text-sm text-slate-500'>За месяц</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <div className='flex items-center justify-between mb-2'>
                            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                                <Star className='w-5 h-5 text-white' />
                            </div>
                        </div>
                        <p className='text-2xl font-bold text-slate-900'>
                            {stats.rating.toFixed(1)}
                        </p>
                        <p className='text-sm text-slate-500'>Рейтинг</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <div className='flex items-center justify-between mb-2'>
                            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center'>
                                <Video className='w-5 h-5 text-white' />
                            </div>
                        </div>
                        <p className='text-2xl font-bold text-slate-900'>
                            {stats.monthlyConsultations}
                        </p>
                        <p className='text-sm text-slate-500'>
                            Консультаций за месяц
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className='grid md:grid-cols-3 gap-6 min-w-0'>
                {/* Today's Schedule */}
                <div className='md:col-span-2 min-w-0'>
                    <Card className='min-w-0'>
                        <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0'>
                            <CardTitle>Расписание на сегодня</CardTitle>
                            <Link
                                to='/doctor/schedule'
                                className='text-sm text-teal-600 hover:text-teal-700 self-start sm:self-auto'>
                                Полное расписание
                            </Link>
                        </CardHeader>
                        <CardContent className='space-y-3 min-w-0'>
                            {todayAppointments.length === 0 ? (
                                <div className='text-center py-8'>
                                    <Calendar className='w-12 h-12 mx-auto text-slate-300 mb-3' />
                                    <p className='text-slate-600'>
                                        На сегодня записей нет
                                    </p>
                                </div>
                            ) : (
                                todayAppointments.map((appointment) => {
                                    const patientName =
                                        appointment.patient?.fullName ||
                                        appointment.patient?.username ||
                                        "Пациент";
                                    const time = new Date(
                                        appointment.dateTime,
                                    ).toLocaleTimeString("ru-RU", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                    const now = new Date();
                                    const aptTime = new Date(
                                        appointment.dateTime,
                                    );

                                    // Длительность консультации (из настроек врача или 30 мин по умолчанию)
                                    const consultationDuration =
                                        doctor?.consultationDuration || 30;
                                    // Буфер после окончания консультации (5 минут)
                                    const bufferMinutes = 5;

                                    // Можно подключиться: за 15 минут до начала и до окончания консультации + буфер
                                    const fifteenMinBefore = new Date(
                                        aptTime.getTime() - 15 * 60 * 1000,
                                    );
                                    const consultationEnd = new Date(
                                        aptTime.getTime() +
                                            (consultationDuration +
                                                bufferMinutes) *
                                                60 *
                                                1000,
                                    );
                                    const canJoin =
                                        ["confirmed", "pending"].includes(
                                            appointment.statuse || appointment.status,
                                        ) &&
                                        now >= fifteenMinBefore &&
                                        now <= consultationEnd;

                                    // Консультация прошла (по времени или принудительно завершена)
                                    const isPastConsultation =
                                        now > consultationEnd ||
                                        appointment.statuse === 'completed';

                                    const isNow =
                                        Math.abs(now - aptTime) <
                                        30 * 60 * 1000; // ±30 минут (для выделения)

                                    return (
                                        <div
                                            key={appointment.id}
                                            className={`p-3 sm:p-4 rounded-xl ${
                                                isNow &&
                                                appointment.status ===
                                                    "confirmed" &&
                                                !isPastConsultation
                                                    ? "bg-teal-50 border-2 border-teal-200"
                                                    : isPastConsultation
                                                      ? "bg-slate-100"
                                                      : "bg-slate-50"
                                            }`}>
                                            {/* Mobile Layout */}
                                            <div className='sm:hidden'>
                                                <div className='flex items-center gap-3'>
                                                    <div className='text-center shrink-0 w-12'>
                                                        <p className={`text-base font-bold ${isPastConsultation ? "text-slate-400" : "text-slate-900"}`}>
                                                            {time}
                                                        </p>
                                                        <p className='text-[10px] text-slate-500'>
                                                            {appointment.type === "video" ? "Видео" : "Чат"}
                                                        </p>
                                                    </div>
                                                    <div className='w-px h-10 bg-slate-200 shrink-0' />
                                                    <Avatar
                                                        src={getMediaUrl(appointment.patient?.avatar)}
                                                        name={patientName}
                                                        size='sm'
                                                    />
                                                    <div className='flex-1 min-w-0'>
                                                        <h4 className={`font-medium text-sm truncate ${isPastConsultation ? "text-slate-500" : "text-slate-900"}`}>
                                                            {patientName}
                                                        </h4>
                                                        <p className='text-xs text-slate-500 truncate'>
                                                            {appointment.patient?.phone || ""}
                                                        </p>
                                                    </div>
                                                    <div className='shrink-0'>
                                                        {isPastConsultation && (appointment.statuse || appointment.status) !== "cancelled" ? (
                                                            <Badge variant='success'>Завершён</Badge>
                                                        ) : (
                                                            getStatusBadge(appointment.statuse || appointment.status)
                                                        )}
                                                    </div>
                                                </div>
                                                {canJoin && appointment.roomId && (
                                                    <Link to={`/consultation/${appointment.roomId}`} className='block mt-2'>
                                                        <Button size='sm' className='w-full' leftIcon={<Video className='w-4 h-4' />}>
                                                            Начать приём
                                                        </Button>
                                                    </Link>
                                                )}
                                                {!canJoin && isPastConsultation && appointment.roomId && (
                                                    <Link
                                                        to={`/doctor/appointments/${appointment.documentId || appointment.id}`}
                                                        className='block mt-2'>
                                                        <Button size='sm' variant='secondary' className='w-full'>
                                                            Детали
                                                        </Button>
                                                    </Link>
                                                )}
                                            </div>

                                            {/* Desktop Layout */}
                                            <div className='hidden sm:flex items-center justify-between gap-4'>
                                                <div className='flex items-center gap-4 min-w-0'>
                                                    <div className='text-center min-w-[60px] shrink-0'>
                                                        <p className={`text-lg font-bold ${isPastConsultation ? "text-slate-400" : "text-slate-900"}`}>
                                                            {time}
                                                        </p>
                                                        <p className='text-xs text-slate-500'>
                                                            {appointment.type === "video" ? "Видео" : "Чат"}
                                                        </p>
                                                    </div>
                                                    <div className='w-px h-12 bg-slate-200' />
                                                    <Avatar
                                                        src={getMediaUrl(appointment.patient?.avatar)}
                                                        name={patientName}
                                                        size='md'
                                                    />
                                                    <div className='min-w-0'>
                                                        <h4 className={`font-medium truncate ${isPastConsultation ? "text-slate-500" : "text-slate-900"}`}>
                                                            {patientName}
                                                        </h4>
                                                        <p className='text-sm text-slate-500 truncate'>
                                                            {appointment.patient?.phone || appointment.patient?.email || ""}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-2 shrink-0'>
                                                    {isPastConsultation && (appointment.statuse || appointment.status) !== "cancelled" ? (
                                                        <Badge variant='success'>Завершён</Badge>
                                                    ) : (
                                                        getStatusBadge(appointment.statuse || appointment.status)
                                                    )}
                                                    {canJoin && appointment.roomId ? (
                                                        <Link to={`/consultation/${appointment.roomId}`}>
                                                            <Button size='sm' leftIcon={<Video className='w-4 h-4' />}>
                                                                Подключиться
                                                            </Button>
                                                        </Link>
                                                    ) : isPastConsultation && appointment.roomId ? (
                                                        <Link to={`/doctor/appointments/${appointment.documentId || appointment.id}`}>
                                                            <Button size='sm' variant='secondary'>Детали</Button>
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className='space-y-6 min-w-0'>
                    {/* Next Appointment */}
                    {nextAppointment &&
                        (() => {
                            const now = new Date();
                            const aptTime = new Date(nextAppointment.dateTime);
                            const consultationDuration =
                                doctor?.consultationDuration || 30;
                            const bufferMinutes = 5;
                            const fifteenMinBefore = new Date(
                                aptTime.getTime() - 15 * 60 * 1000,
                            );
                            const consultationEnd = new Date(
                                aptTime.getTime() +
                                    (consultationDuration + bufferMinutes) *
                                        60 *
                                        1000,
                            );
                            const canJoinNext =
                                now >= fifteenMinBefore &&
                                now <= consultationEnd;

                            return (
                    <Card className='bg-gradient-to-br from-teal-500 to-sky-500 text-white min-w-0'>
                        <CardContent className='min-w-0'>
                                        <div className='flex items-center gap-2 mb-4'>
                                            <Clock className='w-5 h-5' />
                                            <span className='font-medium'>
                                                Следующий приём
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-4'>
                                            <Avatar
                                                src={getMediaUrl(
                                                    nextAppointment.patient
                                                        ?.avatar,
                                                )}
                                                name={
                                                    nextAppointment.patient
                                                        ?.fullName || "Пациент"
                                                }
                                                size='lg'
                                            />
                                            <div>
                                                <h4 className='font-semibold'>
                                                    {nextAppointment.patient?.fullName
                                                        ?.split(" ")
                                                        .slice(0, 2)
                                                        .join(" ") || "Пациент"}
                                                </h4>
                                                <p className='text-white/80 text-sm'>
                                                    {formatRelativeDate(
                                                        nextAppointment.dateTime,
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        {nextAppointment.roomId &&
                                        canJoinNext ? (
                                            <Link
                                                to={`/consultation/${nextAppointment.roomId}`}>
                                                <Button className='w-full mt-4  text-teal-600 hover:bg-white/90 text-teal-600 '>
                                                    <Video className='w-4 h-4 mr-2' />
                                                    Начать приём
                                                </Button>
                                            </Link>
                                        ) : (
                                            <div className='w-full mt-4 py-2.5 px-4 bg-white/20 text-white text-center rounded-xl text-sm'>
                                                {nextAppointment.roomId
                                                    ? "Комната откроется за 15 минут до приёма"
                                                    : "Комната будет доступна перед началом"}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })()}

                    {/* Recent Reviews */}
                    <Card className='min-w-0'>
                        <CardHeader className='min-w-0'>
                            <CardTitle className='flex items-center gap-2'>
                                <Star className='w-5 h-5 text-amber-400' />
                                Отзывы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-3 min-w-0'>
                            {reviews.length === 0 ? (
                                <p className='text-center text-slate-500 py-4 text-sm'>
                                    Пока нет отзывов
                                </p>
                            ) : (
                                reviews.map((review) => (
                                    <div
                                        key={review.id}
                                        className='p-3 bg-slate-50 rounded-xl min-w-0'>
                                        <div className='flex items-center justify-between mb-2'>
                                            <span className='font-medium text-slate-900 text-sm min-w-0 truncate'>
                                                {review.patient?.fullName?.split(
                                                    " ",
                                                )[0] || "Пациент"}
                                            </span>
                                            <div className='flex items-center gap-0.5'>
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${
                                                            i <
                                                            (review.rating || 0)
                                                                ? "text-amber-400 fill-amber-400"
                                                                : "text-slate-200"
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className='text-sm text-slate-600 break-words'>
                                            {review.comment || review.text}
                                        </p>
                                        <p className='text-xs text-slate-400 mt-1'>
                                            {formatDate(review.createdAt)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default DoctorDashboard;
