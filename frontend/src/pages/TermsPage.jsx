import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronLeft, RotateCcw, CreditCard, AlertCircle } from 'lucide-react'

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

export default function TermsPage() {
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
                            <FileText className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Условия использования
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Последнее обновление: 1 марта 2026 г.
                            </p>
                        </div>
                    </div>

                    <Section title="1. Общие положения">
                        <p>
                            Настоящие Условия использования регулируют порядок предоставления
                            услуг телемедицины платформой MedConnect (далее — «Платформа»),
                            принадлежащей ТОО «ННМЦ Диджитал» (далее — «Компания»).
                        </p>
                        <p>
                            Регистрируясь на Платформе или используя её услуги, вы подтверждаете
                            своё согласие с настоящими Условиями в полном объёме.
                        </p>
                    </Section>

                    <Section title="2. Описание услуг">
                        <p>Платформа предоставляет следующие услуги:</p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>
                                <strong>Онлайн-консультация (видеозвонок)</strong> —
                                защищённый видеосеанс с квалифицированным врачом
                                продолжительностью от 20 до 60 минут.
                            </li>
                            <li>
                                <strong>Текстовая консультация</strong> —
                                письменный обмен сообщениями с врачом через чат Платформы.
                            </li>
                            <li>
                                <strong>Электронные медицинские документы</strong> —
                                получение рекомендаций, справок и направлений в электронном виде.
                            </li>
                        </ul>
                        <p className="mt-2">
                            Услуги оказываются после полной оплаты в соответствии с тарифами,
                            указанными в профиле врача.
                        </p>
                    </Section>

                    <Section title="3. Стоимость услуг и оплата">
                        <p>
                            Стоимость консультации указывается в профиле врача и в модальном
                            окне бронирования до момента оплаты. Цена указана в тенге (₸)
                            и включает все применимые налоги.
                        </p>
                        <p>
                            Принимаемые способы оплаты:
                        </p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>Банковская карта (Visa, Mastercard) с поддержкой 3-D Secure</li>
                            <li>QR-оплата через приложение Halyk Home Bank</li>
                        </ul>

                        {/* ePay / Halyk informer block — required by Halyk Bank agreement */}
                        <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-semibold mb-1">
                                    Платёжный партнёр — АО «Народный Банк Казахстана»
                                </p>
                                <p>
                                    Онлайн-платежи обрабатываются через защищённый платёжный шлюз{' '}
                                    <a
                                        href="https://epay.homebank.kz/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-amber-900 font-medium"
                                    >
                                        ePay by Halyk
                                    </a>
                                    {' '}с применением технологии 3-D Secure. Данные вашей карты
                                    не передаются и не хранятся на серверах Платформы.
                                </p>
                            </div>
                        </div>
                    </Section>

                    {/* Refund policy — required by Halyk Bank agreement */}
                    <section id="refund" className="mb-10">
                        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
                            <RotateCcw className="w-5 h-5 text-teal-600" />
                            <h2 className="text-xl font-semibold text-slate-900">
                                4. Порядок отмены и возврата средств
                            </h2>
                        </div>
                        <div className="space-y-4 text-slate-600 leading-relaxed">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                                    <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold">Ситуация</th>
                                            <th className="text-left px-4 py-3 font-semibold">Возврат</th>
                                            <th className="text-left px-4 py-3 font-semibold">Срок</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr className="bg-white">
                                            <td className="px-4 py-3">Отмена пациентом более чем за 24 часа до приёма</td>
                                            <td className="px-4 py-3 text-emerald-600 font-medium">100%</td>
                                            <td className="px-4 py-3">3–5 рабочих дней</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <td className="px-4 py-3">Отмена пациентом менее чем за 24 часа до приёма</td>
                                            <td className="px-4 py-3 text-amber-600 font-medium">50%</td>
                                            <td className="px-4 py-3">3–5 рабочих дней</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="px-4 py-3">Врач не явился на консультацию</td>
                                            <td className="px-4 py-3 text-emerald-600 font-medium">100%</td>
                                            <td className="px-4 py-3">1–3 рабочих дня</td>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            <td className="px-4 py-3">Технический сбой по вине Платформы</td>
                                            <td className="px-4 py-3 text-emerald-600 font-medium">100%</td>
                                            <td className="px-4 py-3">1–3 рабочих дня</td>
                                        </tr>
                                        <tr className="bg-white">
                                            <td className="px-4 py-3">Консультация состоялась в полном объёме</td>
                                            <td className="px-4 py-3 text-rose-500 font-medium">Не предусмотрен</td>
                                            <td className="px-4 py-3">—</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold mb-1">Как запросить возврат</p>
                                    <p>
                                        Напишите на{' '}
                                        <a href="mailto:info@medconnect.kz" className="underline font-medium">
                                            info@medconnect.kz
                                        </a>{' '}
                                        или позвоните по номеру{' '}
                                        <a href="tel:+77172123456" className="underline font-medium">
                                            +7 (7172) 123-456
                                        </a>
                                        , указав номер записи и причину возврата. Возврат
                                        осуществляется на карту, с которой была произведена оплата.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <Section title="5. Обязанности пользователя">
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>Предоставлять достоверную информацию о состоянии здоровья.</li>
                            <li>Не использовать платформу в экстренных ситуациях, требующих вызова скорой помощи.</li>
                            <li>Обеспечить стабильное интернет-соединение для видеоконсультации.</li>
                            <li>Не записывать и не распространять видеосеансы без согласия врача.</li>
                        </ul>
                    </Section>

                    <Section title="6. Ответственность платформы">
                        <p>
                            Платформа несёт ответственность за техническое обеспечение сервиса
                            и корректную обработку платежей. Медицинские рекомендации и заключения
                            предоставляются врачами и являются их профессиональной ответственностью.
                        </p>
                        <p>
                            Платформа не является субъектом медицинской деятельности и не заменяет
                            очного приёма у специалиста.
                        </p>
                    </Section>

                    <Section title="7. Разрешение споров">
                        <p>
                            В случае возникновения спора, в том числе связанного с оплатой через
                            Halyk Bank / ePay, пользователь вправе:
                        </p>
                        <ul className="list-disc pl-6 space-y-1.5">
                            <li>
                                Обратиться в службу поддержки Платформы:{' '}
                                <a href="mailto:info@medconnect.kz" className="text-teal-600 hover:underline">
                                    info@medconnect.kz
                                </a>{' '}
                                или{' '}
                                <a href="tel:+77172123456" className="text-teal-600 hover:underline">
                                    +7 (7172) 123-456
                                </a>
                            </li>
                            <li>
                                Обратиться в АО «Народный Банк Казахстана» через сайт{' '}
                                <a
                                    href="https://epay.homebank.kz/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 hover:underline"
                                >
                                    epay.homebank.kz
                                </a>
                            </li>
                            <li>Обратиться в суд по месту нахождения Компании (г. Астана, РК).</li>
                        </ul>
                    </Section>

                    <Section title="8. Изменения условий">
                        <p>
                            Компания оставляет за собой право обновлять настоящие Условия.
                            Актуальная версия всегда доступна по адресу{' '}
                            <Link to="/terms" className="text-teal-600 hover:underline">
                                medconnect.nnmc.kz/terms
                            </Link>
                            . Продолжение использования Платформы после публикации изменений
                            означает ваше согласие с ними.
                        </p>
                    </Section>

                    <Section title="9. Контактная информация">
                        <ul className="list-none space-y-1.5">
                            <li>🏢 <strong>Компания:</strong> ТОО «ННМЦ Диджитал»</li>
                            <li>📍 <strong>Адрес:</strong> г. Астана, просп. Абылай хана, 42</li>
                            <li>
                                📞 <strong>Телефон:</strong>{' '}
                                <a href="tel:+77172123456" className="text-teal-600 hover:underline">
                                    +7 (7172) 123-456
                                </a>
                            </li>
                            <li>
                                📧 <strong>Email:</strong>{' '}
                                <a href="mailto:info@medconnect.kz" className="text-teal-600 hover:underline">
                                    info@medconnect.kz
                                </a>
                            </li>
                        </ul>
                    </Section>
                </div>

                <div className="mt-6 text-center">
                    <Link to="/privacy" className="text-sm text-teal-600 hover:text-teal-700">
                        ← Политика конфиденциальности
                    </Link>
                </div>
            </div>
        </div>
    )
}
