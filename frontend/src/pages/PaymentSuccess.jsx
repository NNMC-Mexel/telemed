import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import Button from "../components/ui/Button";
import useAppointmentStore from "../stores/appointmentStore";
import useAuthStore from "../stores/authStore";
import { formatPrice } from "../utils/helpers";

function PaymentSuccess() {
    const navigate = useNavigate();
    const { createAppointment } = useAppointmentStore();
    const { user, _hasHydrated } = useAuthStore();
    const [status, setStatus] = useState("creating"); // creating | success | error
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    useEffect(() => {
        if (!_hasHydrated) return;

        const raw = sessionStorage.getItem("pendingBooking");
        if (!raw) {
            navigate("/patient", { replace: true });
            return;
        }

        const booking = JSON.parse(raw);
        sessionStorage.removeItem("pendingBooking");
        createBookingAfterPayment(booking);
    }, [_hasHydrated]);

    const createBookingAfterPayment = async (booking) => {
        try {
            const result = await createAppointment({
                patient: booking.patientId,
                doctor: booking.doctorId,
                dateTime: booking.dateTime,
                type: booking.type,
                status: "confirmed",
                price: booking.price,
                paymentStatus: "paid",
                roomId: booking.roomId,
            });

            if (result.success) {
                setAppointmentInfo({
                    doctorName: booking.doctorName,
                    dateTime: new Date(booking.dateTime),
                    type: booking.type,
                    price: booking.price,
                });
                setStatus("success");
            } else {
                setErrorMessage(result.error || "Ошибка создания записи");
                setStatus("error");
            }
        } catch (err) {
            setErrorMessage("Произошла ошибка. Обратитесь в поддержку.");
            setStatus("error");
        }
    };

    if (status === "creating") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-700 text-lg font-medium">
                        Оплата прошла успешно!
                    </p>
                    <p className="text-slate-500 mt-2">
                        Создаём вашу запись...
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
                        Ошибка создания записи
                    </h2>
                    <p className="text-slate-600 mb-2">{errorMessage}</p>
                    <p className="text-sm text-slate-500 mb-6">
                        Оплата прошла успешно. Пожалуйста, обратитесь в
                        поддержку с чеком об оплате.
                    </p>
                    <Button
                        onClick={() => navigate("/patient/appointments")}>
                        Мои записи
                    </Button>
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
                    Оплата успешна!
                </h2>
                <p className="text-slate-600 mb-6">
                    Ваша запись подтверждена
                </p>

                {appointmentInfo && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Врач</span>
                            <span className="font-medium text-slate-900">
                                {appointmentInfo.doctorName}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Дата</span>
                            <span className="font-medium text-slate-900">
                                {format(
                                    appointmentInfo.dateTime,
                                    "d MMMM yyyy",
                                    { locale: ru }
                                )}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Время</span>
                            <span className="font-medium text-slate-900">
                                {format(appointmentInfo.dateTime, "HH:mm")}
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                            <span className="font-semibold text-teal-700">
                                Оплачено
                            </span>
                            <span className="font-bold text-teal-700">
                                {formatPrice(appointmentInfo.price)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm text-slate-600 mb-1">
                        📧 Подтверждение отправлено на вашу почту
                    </p>
                    <p className="text-sm text-slate-600">
                        🔗 Ссылка на видеоконсультацию появится в личном
                        кабинете
                    </p>
                </div>

                <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => navigate("/")}>
                        На главную
                    </Button>
                    <Button
                        onClick={() =>
                            navigate("/patient/appointments")
                        }>
                        Мои записи
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PaymentSuccess;
