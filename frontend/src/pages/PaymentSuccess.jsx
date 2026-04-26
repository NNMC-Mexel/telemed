import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import { io } from "socket.io-client";
import Button from "../components/ui/Button";
import useAuthStore from "../stores/authStore";
import { formatPrice } from "../utils/helpers";
import { getSignalingUrl } from "../services/api";

function PaymentSuccess() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru;
    const { _hasHydrated } = useAuthStore();
    const [status, setStatus] = useState("creating"); // creating | success | error
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Notify other open BookingModals that this slot is now taken
    const broadcastSlotConfirmed = (booking) => {
        try {
            const dt = new Date(booking.dateTime);
            const date = format(dt, "yyyy-MM-dd");
            const time = format(dt, "HH:mm");
            const socket = io(getSignalingUrl(), {
                auth: { token: useAuthStore.getState().token },
                transports: ["websocket", "polling"],
            });
            socket.on("connect", () => {
                socket.emit("slot-confirmed", {
                    doctorId: booking.doctorId,
                    date,
                    time,
                });
                setTimeout(() => socket.disconnect(), 500);
            });
        } catch {
            // non-critical: clients will refresh slots on next open
        }
    };

    const createBookingAfterPayment = async (booking, userToken, attempt = 1) => {
        const MAX_ATTEMPTS = 3;
        const RETRY_DELAY_MS = 1500;

        try {
            const response = await fetch(
                `${getSignalingUrl()}/api/payment/epay-confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${userToken}`,
                    },
                    body: JSON.stringify({ booking }),
                }
            );
            const result = await response.json();

            if (response.ok && result.success) {
                sessionStorage.removeItem("pendingBooking");
                broadcastSlotConfirmed(booking);
                setAppointmentInfo({
                    doctorName: booking.doctorName,
                    dateTime: new Date(booking.dateTime),
                    type: booking.type,
                    price: booking.price,
                });
                setStatus("success");
            } else {
                if (attempt < MAX_ATTEMPTS) {
                    setTimeout(
                        () => createBookingAfterPayment(booking, userToken, attempt + 1),
                        RETRY_DELAY_MS
                    );
                } else {
                    sessionStorage.removeItem("pendingBooking");
                    setErrorMessage(result.error || t('payment.error_create'));
                    setStatus("error");
                }
            }
        } catch (err) {
            if (attempt < MAX_ATTEMPTS) {
                setTimeout(
                    () => createBookingAfterPayment(booking, userToken, attempt + 1),
                    RETRY_DELAY_MS
                );
            } else {
                sessionStorage.removeItem("pendingBooking");
                setErrorMessage(t('payment.error_fallback'));
                setStatus("error");
            }
        }
    };

    useEffect(() => {
        if (!_hasHydrated) return;

        const raw = sessionStorage.getItem("pendingBooking");
        if (!raw) {
            navigate("/patient", { replace: true });
            return;
        }

        const booking = JSON.parse(raw);
        // НЕ удаляем из sessionStorage до успешного создания —
        // если пользователь обновит страницу в процессе, данные сохранятся
        // Token is read from store at call time to avoid stale-closure in deps
        createBookingAfterPayment(booking, useAuthStore.getState().token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, navigate]);

    if (status === "creating") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-700 text-lg font-medium">
                        {t('payment.creating_title')}
                    </p>
                    <p className="text-slate-500 mt-2">
                        {t('payment.creating_desc')}
                    </p>
                </div>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50 p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
                    <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
                        <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                        {t('payment.error_title')}
                    </h2>
                    <p className="text-slate-600 mb-2">{errorMessage}</p>
                    <p className="text-sm text-slate-500 mb-2">
                        {t('payment.error_payment_ok')}
                    </p>
                    <p className="text-sm text-slate-500 mb-6">
                        {t('payment.error_support')}{' '}
                        <a href="mailto:support@nnmc.kz" className="text-teal-600 underline">
                            support@nnmc.kz
                        </a>{' '}
                        {t('payment.error_support_postfix')}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => navigate("/patient/appointments")}>
                            {t('payment.my_appointments')}
                        </Button>
                        <Button onClick={() => window.location.href = "mailto:support@nnmc.kz"}>
                            {t('payment.contact_support')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
                <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {t('payment.success_title')}
                </h2>
                <p className="text-slate-600 mb-6">
                    {t('payment.success_confirmed')}
                </p>

                {appointmentInfo && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">{t('payment.doctor_label')}</span>
                            <span className="font-medium text-slate-900">
                                {appointmentInfo.doctorName}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">{t('payment.date_label')}</span>
                            <span className="font-medium text-slate-900">
                                {format(
                                    appointmentInfo.dateTime,
                                    "d MMMM yyyy",
                                    { locale: dateLocale }
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">{t('payment.time_label')}</span>
                            <span className="font-medium text-slate-900">
                                {format(appointmentInfo.dateTime, "HH:mm")}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                            <span className="font-semibold text-teal-700">
                                {t('payment.paid_label')}
                            </span>
                            <span className="font-bold text-teal-700">
                                {formatPrice(appointmentInfo.price)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm text-slate-600 mb-1">
                        {t('payment.email_sent')}
                    </p>
                    <p className="text-sm text-slate-600">
                        {t('payment.link_note')}
                    </p>
                </div>

                <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => navigate("/")}>
                        {t('payment.home_btn')}
                    </Button>
                    <Button
                        onClick={() =>
                            navigate("/patient/appointments")
                        }>
                        {t('payment.my_appointments')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PaymentSuccess;
