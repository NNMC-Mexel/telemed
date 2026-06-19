import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from 'react-i18next'
import {
    Calendar,
    Clock,
    Video,
    Users,
    DollarSign,
    Star,
    ChevronRight,
    Loader2,
    FileText,
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
import api, { normalizeResponse, getMediaUrl, getServerNow } from "../../services/api";
import {
    formatRelativeDate,
    formatPrice,
    formatDate,
    getLocalizedField,
} from "../../utils/helpers";
import { getAppointmentPreparation } from "../../utils/appointmentPreparation";

const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"];

function DoctorDashboard() {
    const { t, i18n } = useTranslation()
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
            const doctorRes = await api.get(
                `/api/doctors?filters[userId][$eq]=${user.id}&populate=*&pagination[limit]=1`,
            );
            const doctorData = doctorRes.data?.data?.[0];
            setDoctor(doctorData);

            if (doctorData?.id) {
                const today = new Date().toISOString().split("T")[0];

                const appointmentsRes = await api.get(
                    `/api/appointments?populate=*&pagination[limit]=1000`,
                );

                const { data: allAppointments } = normalizeResponse(appointmentsRes);

                const doctorAppointments = (allAppointments || []).filter(
                    (apt) => {
                        return (
                            apt.doctor?.id === doctorData.id ||
                            (doctorData.documentId &&
                                apt.doctor?.documentId === doctorData.documentId)
                        );
                    },
                );

                setAppointments(doctorAppointments);

                const reviewsRes = await api.get(`/api/reviews?populate=*&pagination[limit]=1000`);
                const { data: allReviews } = normalizeResponse(reviewsRes);
                const allDoctorReviews = (allReviews || [])
                    .filter((r) => r.doctor?.id === doctorData.id);
                const doctorReviews = allDoctorReviews.slice(0, 5);
                setReviews(doctorReviews);

                const computedRating = allDoctorReviews.length > 0
                    ? allDoctorReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allDoctorReviews.length
                    : 0;

                const todayStr = today;
                const todayAppts = doctorAppointments.filter((a) => {
                    const aptDate = new Date(a.dateTime).toISOString().split("T")[0];
                    return aptDate === todayStr && ACTIVE_APPOINTMENT_STATUSES.includes(a.statuse || a.status);
                });

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
                return <Badge variant='success'>{t('appointment.status_completed')}</Badge>;
            case "confirmed":
                return <Badge variant='primary'>{t('appointment.status_confirmed')}</Badge>;
            case "in_progress":
                return <Badge variant='success'>{t('appointment.status_in_progress')}</Badge>;
            case "pending":
                return <Badge variant='warning'>{t('appointment.status_pending')}</Badge>;
            case "cancelled":
                return <Badge variant='danger'>{t('appointment.status_cancelled')}</Badge>;
            default:
                return null;
        }
    };

    const getPreparationBadge = (appointment) => {
        const preparation = getAppointmentPreparation(appointment);
        if (preparation.status === 'ready') {
            return <Badge variant='success'>{t('doctor.prep_ready')}</Badge>;
        }
        if (preparation.status === 'no_documents') {
            return <Badge variant='default'>{t('doctor.prep_no_documents')}</Badge>;
        }
        if (preparation.status === 'access_missing') {
            return <Badge variant='warning'>{t('doctor.prep_access_missing')}</Badge>;
        }
        return <Badge variant='warning'>{t('doctor.prep_waiting')}</Badge>;
    };

    const todayAppointments = appointments.filter((a) => {
        const today = new Date().toISOString().split("T")[0];
        const aptDate = new Date(a.dateTime).toISOString().split("T")[0];
        return aptDate === today;
    });

    const nextAppointment = appointments.find(
        (a) => (a.statuse || a.status) === "confirmed" && new Date(a.dateTime) > new Date(),
    );

    const todayCountWord = stats.todayPatients === 1
        ? t('doctor.count_word_1')
        : t('doctor.count_word_many')

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
                        {t('doctor.greeting', { name: user?.fullName?.split(" ")[1] || user?.fullName?.split(" ")[0] || t('doctor.patient_default') })}
                    </h1>
                    <p className='text-slate-600 mt-1'>
                        {t('doctor.today_appointments', { count: stats.todayPatients, word: todayCountWord })}
                    </p>
                </div>
                <Link to='/doctor/schedule'>
                    <Button rightIcon={<ChevronRight className='w-4 h-4' />}>
                        {t('doctor.schedule_link')}
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
                            {t('doctor.stat_patients_today')}
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
                        <p className='text-sm text-slate-500'>{t('doctor.stat_monthly_earnings')}</p>
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
                        <p className='text-sm text-slate-500'>{t('doctor.stat_rating')}</p>
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
                            {t('doctor.stat_monthly_consultations')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className='grid md:grid-cols-3 gap-6 min-w-0'>
                {/* Today's Schedule */}
                <div className='md:col-span-2 min-w-0'>
                    <Card className='min-w-0'>
                        <CardHeader className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0'>
                            <CardTitle>{t('doctor.today_schedule')}</CardTitle>
                            <Link
                                to='/doctor/schedule'
                                className='text-sm text-teal-600 hover:text-teal-700 self-start sm:self-auto'>
                                {t('doctor.full_schedule')}
                            </Link>
                        </CardHeader>
                        <CardContent className='space-y-3 min-w-0'>
                            {todayAppointments.length === 0 ? (
                                <div className='text-center py-8'>
                                    <Calendar className='w-12 h-12 mx-auto text-slate-300 mb-3' />
                                    <p className='text-slate-600'>
                                        {t('doctor.no_today_appointments')}
                                    </p>
                                </div>
                            ) : (
                                todayAppointments.map((appointment) => {
                                    const patientName =
                                        getLocalizedField(appointment.patient, 'fullName', i18n.language) ||
                                        appointment.patient?.fullName ||
                                        appointment.patient?.username ||
                                        t('doctor.patient_default');
                                    const time = new Date(appointment.dateTime).toLocaleTimeString("ru-RU", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    });
                                    const now = getServerNow();
                                    const aptTime = new Date(appointment.dateTime);

                                    const consultationDuration = doctor?.consultationDuration || 30;
                                    const bufferMinutes = 5;

                                    const fifteenMinBefore = new Date(aptTime.getTime() - 15 * 60 * 1000);
                                    const consultationEnd = new Date(
                                        aptTime.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000,
                                    );
                                    const appointmentStatus = appointment.statuse || appointment.status;
                                    const canJoin =
                                        ACTIVE_APPOINTMENT_STATUSES.includes(appointmentStatus) &&
                                        now >= fifteenMinBefore &&
                                        now <= consultationEnd;

                                    const isPastConsultation =
                                        now > consultationEnd || appointmentStatus === 'completed';

                                    const isNow = Math.abs(now - aptTime) < 30 * 60 * 1000;

                                    return (
                                        <div
                                            key={appointment.id}
                                            className={`p-3 sm:p-4 rounded-xl ${
                                                isNow && ACTIVE_APPOINTMENT_STATUSES.includes(appointmentStatus) && !isPastConsultation
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
                                                            {appointment.type === "video" ? t('doctor.type_video') : t('doctor.type_chat')}
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
                                                            <Badge variant='success'>{t('doctor.status_completed')}</Badge>
                                                        ) : (
                                                            getStatusBadge(appointment.statuse || appointment.status)
                                                        )}
                                                    </div>
                                                </div>
                                                {!isPastConsultation && (
                                                    <div className='mt-2 flex items-center gap-2'>
                                                        <FileText className='w-4 h-4 text-slate-400' />
                                                        {getPreparationBadge(appointment)}
                                                    </div>
                                                )}
                                                {canJoin && appointment.roomId && (
                                                    <Link to={`/consultation/${appointment.roomId}`} className='block mt-2'>
                                                        <Button size='sm' className='w-full' leftIcon={<Video className='w-4 h-4' />}>
                                                            {t('doctor.start_appointment')}
                                                        </Button>
                                                    </Link>
                                                )}
                                                {!canJoin && isPastConsultation && appointment.roomId && (
                                                    <Link to={`/doctor/appointments/${appointment.documentId || appointment.id}`} className='block mt-2'>
                                                        <Button size='sm' variant='secondary' className='w-full'>
                                                            {t('doctor.details')}
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
                                                            {appointment.type === "video" ? t('doctor.type_video') : t('doctor.type_chat')}
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
                                                        <Badge variant='success'>{t('doctor.status_completed')}</Badge>
                                                    ) : (
                                                        getStatusBadge(appointment.statuse || appointment.status)
                                                    )}
                                                    {!isPastConsultation && getPreparationBadge(appointment)}
                                                    {canJoin && appointment.roomId ? (
                                                        <Link to={`/consultation/${appointment.roomId}`}>
                                                            <Button size='sm' leftIcon={<Video className='w-4 h-4' />}>
                                                                {t('doctor.connect')}
                                                            </Button>
                                                        </Link>
                                                    ) : isPastConsultation && appointment.roomId ? (
                                                        <Link to={`/doctor/appointments/${appointment.documentId || appointment.id}`}>
                                                            <Button size='sm' variant='secondary'>{t('doctor.details')}</Button>
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
                            const now = getServerNow();
                            const aptTime = new Date(nextAppointment.dateTime);
                            const consultationDuration = doctor?.consultationDuration || 30;
                            const bufferMinutes = 5;
                            const fifteenMinBefore = new Date(aptTime.getTime() - 15 * 60 * 1000);
                            const consultationEnd = new Date(
                                aptTime.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000,
                            );
                            const canJoinNext = now >= fifteenMinBefore && now <= consultationEnd;

                            return (
                                <Card className='bg-gradient-to-br from-teal-500 to-sky-500 text-white min-w-0'>
                                    <CardContent className='min-w-0'>
                                        <div className='flex items-center gap-2 mb-4'>
                                            <Clock className='w-5 h-5' />
                                            <span className='font-medium'>
                                                {t('doctor.next_appointment')}
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-4'>
                                            <Avatar
                                                src={getMediaUrl(nextAppointment.patient?.avatar)}
                                                name={getLocalizedField(nextAppointment.patient, 'fullName', i18n.language) || nextAppointment.patient?.fullName || t('doctor.patient_default')}
                                                size='lg'
                                            />
                                            <div>
                                                <h4 className='font-semibold'>
                                                    {(getLocalizedField(nextAppointment.patient, 'fullName', i18n.language) || nextAppointment.patient?.fullName)?.split(" ").slice(0, 2).join(" ") || t('doctor.patient_default')}
                                                </h4>
                                                <p className='text-white/80 text-sm'>
                                                    {formatRelativeDate(nextAppointment.dateTime)}
                                                </p>
                                            </div>
                                        </div>
                                        {nextAppointment.roomId && canJoinNext ? (
                                            <Link to={`/consultation/${nextAppointment.roomId}`}>
                                                <Button className='w-full mt-4 text-teal-600 hover:bg-white/90'>
                                                    <Video className='w-4 h-4 mr-2' />
                                                    {t('doctor.start_appointment')}
                                                </Button>
                                            </Link>
                                        ) : (
                                            <div className='w-full mt-4 py-2.5 px-4 bg-white/20 text-white text-center rounded-xl text-sm'>
                                                {nextAppointment.roomId
                                                    ? t('doctor.room_opens_15min')
                                                    : t('doctor.room_available_soon')}
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
                                {t('doctor.reviews_title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-3 min-w-0'>
                            {reviews.length === 0 ? (
                                <p className='text-center text-slate-500 py-4 text-sm'>
                                    {t('doctor.no_reviews')}
                                </p>
                            ) : (
                                reviews.map((review) => (
                                    <div key={review.id} className='p-3 bg-slate-50 rounded-xl min-w-0'>
                                        <div className='flex items-center justify-between mb-2'>
                                            <span className='font-medium text-slate-900 text-sm min-w-0 truncate'>
                                                {review.patient?.fullName?.split(" ")[0] || t('doctor.patient_default')}
                                            </span>
                                            <div className='flex items-center gap-0.5'>
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${
                                                            i < (review.rating || 0)
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
                                            {formatDate(review.createdAt, i18n.language)}
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
