import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Video,
    Shield,
    Clock,
    Star,
    ArrowRight,
    CheckCircle,
    Calendar,
    MessageCircle,
    FileText,
    Heart,
    Brain,
    Eye,
    Stethoscope,
    Baby,
    Pill,
    Users,
    Award,
    Zap,
    Loader2,
    Phone,
    Mail,
    MapPin,
    Play,
    HeartPulse,
    UserCheck,
    Headphones,
} from "lucide-react";
import Button from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import {
    doctorsAPI,
    specializationsAPI,
    getMediaUrl,
    normalizeResponse,
} from "../services/api";

const features = [
    {
        icon: Video,
        title: "Видеоконсультации",
        description:
            "HD качество связи без задержек. Безопасное P2P соединение для комфортного общения.",
    },
    {
        icon: Shield,
        title: "Безопасность данных",
        description:
            "Шифрование данных и соответствие стандартам медицинской безопасности.",
    },
    {
        icon: Clock,
        title: "Доступно 24/7",
        description:
            "Запишитесь на удобное время или получите срочную консультацию в любой момент.",
    },
    {
        icon: FileText,
        title: "Электронные документы",
        description:
            "Рецепты, заключения и направления в электронном виде сразу после консультации.",
    },
];

const advantages = [
    {
        icon: HeartPulse,
        title: "Опытные врачи",
        description:
            "Только сертифицированные специалисты с подтверждённым опытом",
    },
    {
        icon: UserCheck,
        title: "Удобно и быстро",
        description: "Консультация из любой точки мира без очередей и ожидания",
    },
    {
        icon: Headphones,
        title: "Поддержка 24/7",
        description:
            "Служба поддержки всегда на связи для решения ваших вопросов",
    },
];

// Иконки для специализаций
const specializationIcons = {
    Терапевт: Stethoscope,
    Кардиолог: Heart,
    Невролог: Brain,
    Офтальмолог: Eye,
    Педиатр: Baby,
    Эндокринолог: Pill,
    default: Stethoscope,
};

const steps = [
    {
        number: "01",
        title: "Выберите врача",
        description: "Найдите специалиста по направлению, рейтингу или отзывам",
    },
    {
        number: "02",
        title: "Запишитесь на приём",
        description: "Выберите удобные дату и время для консультации",
    },
    {
        number: "03",
        title: "Оплатите онлайн",
        description: "Безопасная оплата через Kaspi, Halyk или картой",
    },
    {
        number: "04",
        title: "Получите консультацию",
        description: "Подключитесь к видеозвонку в назначенное время",
    },
];

const testimonials = [
    {
        name: "Айгерим К.",
        text: "Отличный сервис! Получила консультацию терапевта за 15 минут, не выходя из дома.",
        rating: 5,
        avatar: "АК",
    },
    {
        name: "Арман Б.",
        text: "Очень удобно для занятых людей. Врач был внимательным и профессиональным.",
        rating: 5,
        avatar: "АБ",
    },
    {
        name: "Динара М.",
        text: "Записала ребёнка к педиатру онлайн. Быстро, удобно, рекомендую!",
        rating: 5,
        avatar: "ДМ",
    },
];

function LandingPage() {
    const [doctors, setDoctors] = useState([]);
    const [specializations, setSpecializations] = useState([]);
    const [stats, setStats] = useState({
        consultations: 0,
        doctors: 0,
        avgRating: 0,
        satisfaction: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Загружаем врачей
                const doctorsRes = await doctorsAPI.getAll();
                const { data: doctorsData } = normalizeResponse(doctorsRes);
                setDoctors(doctorsData?.slice(0, 3) || []);

                // Загружаем специализации
                const specsRes = await specializationsAPI.getAll();
                const { data: specsData } = normalizeResponse(specsRes);
                setSpecializations(specsData?.slice(0, 6) || []);

                // Подсчитываем статистику
                const totalDoctors = doctorsData?.length || 0;
                const avgRating = doctorsData?.length
                    ? (
                          doctorsData.reduce(
                              (sum, d) => sum + (d.rating || 0),
                              0
                          ) / doctorsData.length
                      ).toFixed(1)
                    : 0;

                setStats({
                    consultations: totalDoctors * 100 + 500,
                    doctors: totalDoctors,
                    avgRating: avgRating,
                    satisfaction: 98,
                });
            } catch (error) {
                console.error("Error fetching landing data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <div className='overflow-hidden'>
            {/* Hero Section */}
            <section className='relative min-h-screen flex items-center bg-gradient-to-br from-teal-600 via-teal-700 to-sky-800'>
                {/* Background Effects */}
                <div className='absolute inset-0 overflow-hidden'>
                    <div className='absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl' />
                    <div className='absolute bottom-20 right-20 w-96 h-96 bg-sky-300/20 rounded-full blur-3xl' />
                    <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-3xl' />
                </div>

                <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium mb-6 backdrop-blur-sm border border-white/20'>
                                <Zap className='w-4 h-4 text-amber-400' />
                                Быстрая и удобная медицинская помощь
                            </span>
                            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6'>
                                Консультация с врачом{" "}
                                <span className='text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-200'>
                                    онлайн
                                </span>
                            </h1>
                            <p className='text-xl text-white/80 mb-8 max-w-lg leading-relaxed'>
                                Получите квалифицированную медицинскую помощь не
                                выходя из дома. Более{" "}
                                {stats.doctors > 0 ? stats.doctors : "50"}{" "}
                                врачей различных специализаций готовы помочь вам
                                прямо сейчас.
                            </p>
                            <div className='flex flex-col sm:flex-row gap-4'>
                                <Link to='/doctors'>
                                    <Button
                                        size='lg'
                                        className=' text-teal-700 hover:bg-teal-50 shadow-lg shadow-black/10 font-semibold'>
                                        Найти врача
                                        <ArrowRight className='w-5 h-5 ml-2' />
                                    </Button>
                                </Link>
                                <Link to='/register'>
                                    <Button
                                        size='lg'
                                        className='bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg font-semibold'>
                                        Регистрация
                                    </Button>
                                </Link>
                            </div>

                            {/* Stats */}
                            <div className='grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-12 border-t border-white/20'>
                                <div>
                                    <div className='text-3xl font-bold text-white'>
                                        {stats.consultations || 500}+
                                    </div>
                                    <div className='text-sm text-white/60'>
                                        Консультаций
                                    </div>
                                </div>
                                <div>
                                    <div className='text-3xl font-bold text-white'>
                                        {stats.doctors || 50}+
                                    </div>
                                    <div className='text-sm text-white/60'>
                                        Врачей
                                    </div>
                                </div>
                                <div>
                                    <div className='text-3xl font-bold text-white'>
                                        {stats.avgRating || "4.9"}
                                    </div>
                                    <div className='text-sm text-white/60'>
                                        Средний рейтинг
                                    </div>
                                </div>
                                <div>
                                    <div className='text-3xl font-bold text-white'>
                                        {stats.satisfaction || 98}%
                                    </div>
                                    <div className='text-sm text-white/60'>
                                        Довольных
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content - Floating Card */}
                        <div className='hidden lg:block relative'>
                            <div className='absolute -top-10 -right-10 w-72 h-72 bg-teal-500/30 rounded-full blur-3xl' />
                            <Card className='relative bg-white/95 backdrop-blur shadow-2xl border-0'>
                                <CardContent className='p-8'>
                                    <div className='flex items-center gap-4 mb-6'>
                                        <div className='w-16 h-16 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg'>
                                            <Video className='w-8 h-8 text-white' />
                                        </div>
                                        <div>
                                            <h3 className='text-lg font-semibold text-slate-900'>
                                                Онлайн-консультация
                                            </h3>
                                            <p className='text-slate-500'>
                                                Выберите удобное время
                                            </p>
                                        </div>
                                    </div>

                                    <div className='space-y-4 mb-6'>
                                        {advantages.map((adv, idx) => (
                                            <div
                                                key={idx}
                                                className='flex items-center gap-3'>
                                                <div className='w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                                                    <adv.icon className='w-5 h-5 text-teal-600' />
                                                </div>
                                                <div>
                                                    <p className='font-medium text-slate-900 text-sm'>
                                                        {adv.title}
                                                    </p>
                                                    <p className='text-xs text-slate-500'>
                                                        {adv.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Link to='/doctors' className='block'>
                                        <Button className='w-full'>
                                            Записаться сейчас
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className='absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce'>
                    <span className='text-white/60 text-sm mb-2'>
                        Узнать больше
                    </span>
                    <div className='w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-1'>
                        <div className='w-1.5 h-3 bg-white/60 rounded-full' />
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            Почему мы
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            Почему выбирают MedConnect
                        </h2>
                        <p className='text-xl text-slate-600 max-w-2xl mx-auto'>
                            Современные технологии для вашего здоровья и
                            комфорта
                        </p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {features.map((feature, index) => (
                            <Card
                                key={index}
                                hover
                                className='text-center border-0 shadow-lg shadow-slate-200/50'>
                                <CardContent className='pt-8'>
                                    <div className='w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30'>
                                        <feature.icon className='w-8 h-8 text-white' />
                                    </div>
                                    <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                                        {feature.title}
                                    </h3>
                                    <p className='text-slate-600'>
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Specializations Section */}
            <section
                id='specializations'
                className='py-24 bg-gradient-to-b from-slate-50 to-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            Специализации
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            Выберите нужного специалиста
                        </h2>
                        <p className='text-xl text-slate-600'>
                            Широкий спектр медицинских направлений
                        </p>
                    </div>

                    {isLoading ? (
                        <div className='flex justify-center py-12'>
                            <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
                        </div>
                    ) : specializations.length > 0 ? (
                        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6'>
                            {specializations.map((spec) => {
                                const IconComponent =
                                    specializationIcons[spec.name] ||
                                    specializationIcons.default;
                                return (
                                    <Link
                                        key={spec.id}
                                        to={`/doctors?specialization=${spec.name}`}
                                        className='group'>
                                        <Card
                                            hover
                                            className='text-center transition-all group-hover:border-teal-500 group-hover:shadow-lg'>
                                            <CardContent className='py-8'>
                                                <div className='w-16 h-16 mx-auto mb-4 bg-teal-100 rounded-2xl flex items-center justify-center group-hover:bg-teal-500 transition-colors'>
                                                    <IconComponent className='w-8 h-8 text-teal-600 group-hover:text-white transition-colors' />
                                                </div>
                                                <h3 className='font-medium text-slate-900 group-hover:text-teal-600 transition-colors'>
                                                    {spec.name}
                                                </h3>
                                                {spec.doctorsCount > 0 && (
                                                    <p className='text-sm text-slate-500 mt-1'>
                                                        {spec.doctorsCount}{" "}
                                                        врачей
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6'>
                            {Object.entries(specializationIcons)
                                .filter(([k]) => k !== "default")
                                .map(([name, Icon]) => (
                                    <Link
                                        key={name}
                                        to={`/doctors?specialization=${name}`}
                                        className='group'>
                                        <Card
                                            hover
                                            className='text-center transition-all group-hover:border-teal-500'>
                                            <CardContent className='py-8'>
                                                <div className='w-16 h-16 mx-auto mb-4 bg-teal-100 rounded-2xl flex items-center justify-center group-hover:bg-teal-500 transition-colors'>
                                                    <Icon className='w-8 h-8 text-teal-600 group-hover:text-white transition-colors' />
                                                </div>
                                                <h3 className='font-medium text-slate-900 group-hover:text-teal-600 transition-colors'>
                                                    {name}
                                                </h3>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                        </div>
                    )}

                    <div className='text-center mt-12'>
                        <Link to='/doctors'>
                            <Button
                                variant='outline'
                                size='lg'
                                rightIcon={<ArrowRight className='w-5 h-5' />}>
                                Все специализации
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            Как это работает
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            Всего 4 простых шага
                        </h2>
                        <p className='text-xl text-slate-600'>
                            До консультации с врачом
                        </p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className='relative text-center lg:text-left'>
                                <div className='text-7xl font-bold text-teal-100 mb-4'>
                                    {step.number}
                                </div>
                                <h3 className='text-xl font-semibold text-slate-900 mb-2'>
                                    {step.title}
                                </h3>
                                <p className='text-slate-600'>
                                    {step.description}
                                </p>
                                {index < steps.length - 1 && (
                                    <ArrowRight className='hidden lg:block absolute top-8 -right-4 w-8 h-8 text-teal-300' />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Top Doctors Section */}
            {doctors.length > 0 && (
                <section className='py-24 bg-gradient-to-b from-slate-50 to-white'>
                    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                        <div className='flex flex-col sm:flex-row items-center justify-between mb-12 gap-4'>
                            <div className='text-center sm:text-left'>
                                <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                                    Наши врачи
                                </span>
                                <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-2'>
                                    Лучшие специалисты
                                </h2>
                                <p className='text-slate-600'>
                                    Квалифицированные врачи с высоким рейтингом
                                </p>
                            </div>
                            <Link to='/doctors'>
                                <Button
                                    variant='outline'
                                    rightIcon={
                                        <ArrowRight className='w-4 h-4' />
                                    }>
                                    Все врачи
                                </Button>
                            </Link>
                        </div>

                        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
                            {doctors.map((doctor) => {
                                const specName =
                                    typeof doctor.specialization === "object"
                                        ? doctor.specialization?.name
                                        : doctor.specialization || "Специалист";

                                return (
                                    <Card
                                        key={doctor.id}
                                        hover
                                        className='overflow-hidden'>
                                        <CardContent className='p-0'>
                                            <div className='p-6'>
                                                <div className='flex items-center gap-4 mb-4'>
                                                    <Avatar
                                                        src={getMediaUrl(
                                                            doctor.photo
                                                        )}
                                                        name={doctor.fullName}
                                                        size='xl'
                                                    />
                                                    <div>
                                                        <h3 className='font-semibold text-slate-900'>
                                                            {doctor.fullName}
                                                        </h3>
                                                        <p className='text-teal-600'>
                                                            {specName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-4 text-sm text-slate-600 mb-4'>
                                                    <div className='flex items-center gap-1'>
                                                        <Star className='w-4 h-4 text-amber-400 fill-amber-400' />
                                                        <span className='font-medium text-slate-900'>
                                                            {doctor.rating || 0}
                                                        </span>
                                                        <span>
                                                            (
                                                            {doctor.reviewsCount ||
                                                                0}
                                                            )
                                                        </span>
                                                    </div>
                                                    <div className='flex items-center gap-1'>
                                                        <Clock className='w-4 h-4' />
                                                        <span>
                                                            {doctor.experience ||
                                                                0}{" "}
                                                            лет опыта
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className='text-slate-600 text-sm mb-4 line-clamp-2'>
                                                    {doctor.shortBio ||
                                                        doctor.bio ||
                                                        "Опытный специалист"}
                                                </p>
                                            </div>
                                            <div className='px-6 py-4 bg-slate-50 flex items-center justify-between'>
                                                <p className='font-bold text-teal-600 text-lg'>
                                                    {(
                                                        doctor.price || 0
                                                    ).toLocaleString()}{" "}
                                                    ₸
                                                </p>
                                                <Link to='/doctors'>
                                                    <Button size='sm'>
                                                        Записаться
                                                    </Button>
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* Testimonials */}
            <section className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            Отзывы
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            Что говорят наши пациенты
                        </h2>
                        <p className='text-xl text-slate-600'>
                            Более 1000 довольных пациентов
                        </p>
                    </div>

                    <div className='grid md:grid-cols-3 gap-8'>
                        {testimonials.map((testimonial, idx) => (
                            <Card key={idx} className='border-0 shadow-lg'>
                                <CardContent className='p-8'>
                                    <div className='flex items-center gap-1 mb-4'>
                                        {[...Array(testimonial.rating)].map(
                                            (_, i) => (
                                                <Star
                                                    key={i}
                                                    className='w-5 h-5 text-amber-400 fill-amber-400'
                                                />
                                            )
                                        )}
                                    </div>
                                    <p className='text-slate-600 mb-6 italic'>
                                        "{testimonial.text}"
                                    </p>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold'>
                                            {testimonial.avatar}
                                        </div>
                                        <p className='font-medium text-slate-900'>
                                            {testimonial.name}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section
                id='about'
                className='py-24 bg-gradient-to-br from-teal-600 to-sky-700'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='inline-block px-4 py-1 bg-white/20 text-white rounded-full text-sm font-medium mb-6'>
                                О нас
                            </span>
                            <h2 className='text-3xl sm:text-4xl font-bold mb-6'>
                                MedConnect — ваш надёжный партнёр в заботе о
                                здоровье
                            </h2>
                            <p className='text-white/80 text-lg mb-6 leading-relaxed'>
                                Мы создали современную платформу телемедицины,
                                которая делает качественную медицинскую помощь
                                доступной каждому. Наша миссия — объединить
                                пациентов и лучших врачей Казахстана.
                            </p>
                            <div className='space-y-4 mb-8'>
                                <div className='flex items-center gap-3'>
                                    <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                    <span className='text-white/90'>
                                        Лицензированные врачи с подтверждённым
                                        опытом
                                    </span>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                    <span className='text-white/90'>
                                        Безопасная и защищённая платформа
                                    </span>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                    <span className='text-white/90'>
                                        Круглосуточная поддержка пациентов
                                    </span>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                    <span className='text-white/90'>
                                        Электронные рецепты и документы
                                    </span>
                                </div>
                            </div>
                            <Link to='/register'>
                                <Button
                                    size='lg'
                                    className=' text-teal-700 hover:bg-teal-50'>
                                    Присоединиться
                                    <ArrowRight className='w-5 h-5 ml-2' />
                                </Button>
                            </Link>
                        </div>
                        <div className='hidden lg:block'>
                            <div className='grid grid-cols-2 gap-6'>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Users className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {stats.consultations}+
                                        </div>
                                        <p className='text-white/70'>
                                            Консультаций проведено
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Award className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {stats.avgRating || "4.9"}
                                        </div>
                                        <p className='text-white/70'>
                                            Средняя оценка
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Stethoscope className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {stats.doctors || 50}+
                                        </div>
                                        <p className='text-white/70'>
                                            Врачей на платформе
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Heart className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {stats.satisfaction}%
                                        </div>
                                        <p className='text-white/70'>
                                            Довольных пациентов
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className='py-24 bg-white'>
                <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
                    <div className='bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 shadow-2xl'>
                        <Award className='w-16 h-16 mx-auto mb-6 text-teal-400' />
                        <h2 className='text-3xl sm:text-4xl font-bold mb-4 text-white'>
                            Начните заботиться о здоровье уже сегодня
                        </h2>
                        <p className='text-xl text-slate-300 mb-8 max-w-2xl mx-auto'>
                            Регистрация займёт всего 2 минуты. Получите доступ к
                            лучшим врачам Казахстана.
                        </p>
                        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                            <Link to='/register'>
                                <Button
                                    size='lg'
                                    className='bg-teal-500 hover:bg-teal-600 text-white shadow-lg'>
                                    Зарегистрироваться бесплатно
                                </Button>
                            </Link>
                            <Link to='/doctors'>
                                <Button
                                    size='lg'
                                    className='bg-white/20 backdrop-blur border-2 border-white/50 text-white hover:bg-white/30'>
                                    Посмотреть врачей
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default LandingPage;
