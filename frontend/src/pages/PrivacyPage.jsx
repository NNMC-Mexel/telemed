import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, ChevronLeft } from 'lucide-react'

function Section({ title, children }) {
    return (
        <section className="mb-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                {title}
            </h2>
            <div className="space-y-3 text-slate-600 leading-relaxed">
                {children}
            </div>
        </section>
    )
}

export default function PrivacyPage() {
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 mb-8"
                >
                    <ChevronLeft className="w-4 h-4" />
                    На главную
                </Link>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-10">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Shield className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Политика конфиденциальности
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Последнее обновление: 1 марта 2026 г.
                            </p>
                        </div>
                    </div>

                    <Section title="1. Общие положения">
                        <p>
                            Настоящая Политика конфиденциальности описывает, как МедКоннект
                            (далее — «Компания», «мы») собирает, использует и защищает персональные
                            данные пользователей платформы MedConnect (medconnect.nnmc.kz).
                        </p>
                        <p>
                            Используя сервис, вы соглашаетесь с условиями данной Политики.
                            Если вы не согласны — пожалуйста, прекратите использование сервиса.
                        </p>
                    </Section>

                    <Section title="2. Сбор и использование данных">
                        <p>Мы собираем следующие категории данных:</p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>
                                <strong>Регистрационные данные:</strong> имя, фамилия, email, телефон,
                                дата рождения — для создания и идентификации учётной записи.
                            </li>
                            <li>
                                <strong>Медицинские данные:</strong> информация, которую вы предоставляете
                                врачу в ходе консультации, — передаётся исключительно лечащему врачу
                                и обрабатывается с соблюдением врачебной тайны.
                            </li>
                            <li>
                                <strong>Платёжные данные:</strong> мы не хранятся реквизиты банковских
                                карт. Платежи обрабатываются через сертифицированный платёжный шлюз
                                АО «Народный Банк Казахстана» (Halyk Bank / ePay).
                            </li>
                            <li>
                                <strong>Технические данные:</strong> IP-адрес, тип браузера,
                                cookie-файлы — для обеспечения работоспособности сервиса.
                            </li>
                        </ul>
                    </Section>

                    <Section title="3. Передача данных третьим лицам">
                        <p>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением:</p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>Врачей платформы — в части медицинской информации, необходимой для оказания услуги.</li>
                            <li>
                                <strong>АО «Народный Банк Казахстана» (ePay)</strong> — имя, email,
                                телефон при проведении оплаты через платёжный шлюз.
                            </li>
                            <li>Государственных органов — по законному требованию.</li>
                        </ul>
                    </Section>

                    <Section title="4. Защита данных">
                        <p>
                            Для защиты ваших данных применяются технические и организационные меры:
                            шифрование HTTPS/TLS, хэширование паролей, ограничение доступа к базе данных.
                            Платёжные транзакции обрабатываются по технологии 3-D Secure.
                        </p>
                    </Section>

                    <Section title="5. Cookie-файлы">
                        <p>
                            Сайт использует cookie для корректной работы авторизации и аналитики.
                            Вы можете отключить cookie в настройках браузера, однако некоторые
                            функции сервиса могут стать недоступны.
                        </p>
                    </Section>

                    <Section title="6. Хранение и удаление данных">
                        <p>
                            Данные хранятся в течение срока действия вашей учётной записи и
                            3 лет после её удаления (в соответствии с требованиями законодательства РК).
                            По письменному запросу на info@medconnect.kz мы удалим вашу учётную запись
                            и связанные с ней данные в течение 30 дней, если это не противоречит
                            требованиям закона.
                        </p>
                    </Section>

                    <Section title="7. Права пользователя">
                        <p>Вы вправе:</p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>Запросить доступ к своим персональным данным.</li>
                            <li>Потребовать исправления неточных данных.</li>
                            <li>Отозвать согласие на обработку данных.</li>
                            <li>Обратиться с жалобой в уполномоченный орган по защите персональных данных РК.</li>
                        </ul>
                    </Section>

                    <Section title="8. Изменения Политики">
                        <p>
                            Мы оставляем за собой право вносить изменения в настоящую Политику.
                            При существенных изменениях пользователи будут уведомлены по email
                            или через уведомление в личном кабинете.
                        </p>
                    </Section>

                    <Section title="9. Контакты">
                        <p>По вопросам обработки персональных данных обращайтесь:</p>
                        <ul className="list-none space-y-1.5 mt-2">
                            <li>📧 <strong>Email:</strong> info@medconnect.kz</li>
                            <li>📞 <strong>Телефон:</strong> +7 (7172) 123-456</li>
                            <li>📍 <strong>Адрес:</strong> г. Астана, просп. Абылай хана, 42</li>
                        </ul>
                    </Section>
                </div>

                <div className="mt-6 text-center">
                    <Link to="/terms" className="text-sm text-teal-600 hover:text-teal-700">
                        Условия использования и политика возврата →
                    </Link>
                </div>
            </div>
        </div>
    )
}
