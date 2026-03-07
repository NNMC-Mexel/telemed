import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import Button from "../components/ui/Button";

function PaymentFailure() {
    const navigate = useNavigate();

    // Clear any pending booking since payment failed
    sessionStorage.removeItem("pendingBooking");

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Оплата отклонена
                </h2>
                <p className="text-slate-600 mb-6">
                    Платёж не прошёл. Запись не создана.
                </p>

                <div className="bg-amber-50 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm text-amber-800">
                        💡 Проверьте баланс карты и правильность введённых
                        данных. Деньги не были списаны.
                    </p>
                </div>

                <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={() => navigate("/")}>
                        На главную
                    </Button>
                    <Button onClick={() => navigate("/doctors")}>
                        Попробовать снова
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default PaymentFailure;
