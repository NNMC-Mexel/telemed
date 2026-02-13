import { useState, useEffect, useRef } from "react";
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
    ThumbsUp,
    ChevronLeft,
    Send,
    ExternalLink,
} from "lucide-react";
import Button from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import {
    contentAPI,
    doctorsAPI,
    specializationsAPI,
    getMediaUrl,
    normalizeResponse,
} from "../services/api";
import { cn, getInitials, isDoctorOnline } from "../utils/helpers";

// Gradient colors for doctor card initials
const doctorCardColors = [
    "bg-gradient-to-br from-teal-400 to-teal-600",
    "bg-gradient-to-br from-sky-400 to-sky-600",
    "bg-gradient-to-br from-violet-400 to-violet-600",
    "bg-gradient-to-br from-rose-400 to-rose-600",
    "bg-gradient-to-br from-amber-400 to-amber-600",
    "bg-gradient-to-br from-emerald-400 to-emerald-600",
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
];

const featureIcons = [Video, Shield, Clock, FileText];
const advantageIcons = [HeartPulse, UserCheck, Headphones];

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

const stripHtml = (value = "") =>
    value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const defaultLandingConfig = {
    hero: {
        badge: "Быстрая и удобная медицинская помощь",
        titlePrefix: "Консультация с врачом",
        titleHighlight: "онлайн",
        description:
            "Получите квалифицированную медицинскую помощь не выходя из дома. Наши специалисты готовы помочь вам прямо сейчас.",
        primaryButtonLabel: "Найти врача",
        secondaryButtonLabel: "Регистрация",
    },
    heroCard: {
        title: "Онлайн-консультация",
        subtitle: "Выберите удобное время",
        items: [
            {
                title: "Опытные врачи",
                description:
                    "Только сертифицированные специалисты с подтверждённым опытом",
            },
            {
                title: "Удобно и быстро",
                description:
                    "Консультация из любой точки мира без очередей и ожидания",
            },
            {
                title: "Поддержка 24/7",
                description:
                    "Служба поддержки всегда на связи для решения ваших вопросов",
            },
        ],
        buttonLabel: "Записаться сейчас",
    },
    stats: [
        { value: "1100+", label: "Консультаций" },
        { value: "6+", label: "Врачей" },
        { value: "4.9", label: "Средний рейтинг" },
        { value: "98%", label: "Довольных" },
    ],
    featuresSection: {
        badge: "Почему мы",
        title: "Почему выбирают MedConnect",
        subtitle: "Современные технологии для вашего здоровья и комфорта",
        cards: [
            {
                title: "Видеоконсультации",
                description:
                    "HD качество связи без задержек. Безопасное P2P соединение для комфортного общения.",
            },
            {
                title: "Безопасность данных",
                description:
                    "Шифрование данных и соответствие стандартам медицинской безопасности.",
            },
            {
                title: "Доступно 24/7",
                description:
                    "Запишитесь на удобное время или получите срочную консультацию в любой момент.",
            },
            {
                title: "Электронные документы",
                description:
                    "Рецепты, заключения и направления в электронном виде сразу после консультации.",
            },
        ],
    },
    stepsSection: {
        badge: "Как это работает",
        title: "Всего 4 простых шага",
        subtitle: "До консультации с врачом",
        steps: [
            {
                title: "Выберите врача",
                description:
                    "Найдите специалиста по направлению, рейтингу или отзывам",
            },
            {
                title: "Запишитесь на приём",
                description: "Выберите удобные дату и время для консультации",
            },
            {
                title: "Оплатите онлайн",
                description: "Безопасная оплата через Kaspi, Halyk или картой",
            },
            {
                title: "Получите консультацию",
                description: "Подключитесь к видеозвонку в назначенное время",
            },
        ],
    },
    aboutSection: {
        badge: "О нас",
        title: "MedConnect — ваш надёжный партнёр в заботе о здоровье",
        description:
            "Мы создали современную платформу телемедицины, которая делает качественную медицинскую помощь доступной каждому.",
        bullets: [
            "Лицензированные врачи с подтверждённым опытом",
            "Безопасная и защищённая платформа",
            "Круглосуточная поддержка пациентов",
            "Электронные рецепты и документы",
        ],
        buttonLabel: "Присоединиться",
    },
    contactSection: {
        badge: "Контакты",
        title: "Свяжитесь с нами",
        subtitle: "Мы всегда на связи и готовы ответить на ваши вопросы",
        phone: {
            title: "Телефон",
            note: "Пн-Пт: 8:00 — 20:00, Сб: 9:00 — 15:00",
            value: "+7 (717) 270-12-34",
        },
        email: {
            title: "Электронная почта",
            note: "Ответим в течение 24 часов",
            value: "info@medconnect.kz",
        },
        address: {
            title: "Адрес",
            note: "Приём по записи",
            value: "г. Астана, просп. Абылай хана, 42",
        },
        quickCard: {
            title: "Нужна быстрая консультация?",
            description:
                "Запишитесь на онлайн-консультацию с врачом прямо сейчас. Наши специалисты помогут вам в кратчайшие сроки.",
            bullets: [
                "Без очередей и ожидания",
                "Консультация из любой точки",
                "Запись результатов в личный кабинет",
            ],
            buttonLabel: "Записаться к врачу",
        },
        mapEmbedUrl:
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2505.5!2d71.4926513!3d51.1492038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4245817a521995c9%3A0xe653c982ba77912!2z0J3QsNGG0LjQvtC90LDQu9GM0L3Ri9C5INC90LDRg9GH0L3Ri9C5INC80LXQtNC40YbQuNC90YHQutC40Lkg0YbQtdC90YLRgA!5e0!3m2!1sru!2skz!4v1700000000000!5m2!1sru!2skz",
    },
};

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

// Doctors Carousel Component
function DoctorsCarousel({ doctors }) {
    const carouselRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const touchStartX = useRef(null);

    // Responsive cards per page
    const [cardsPerPage, setCardsPerPage] = useState(4);

    useEffect(() => {
        const updateCardsPerPage = () => {
            const width = window.innerWidth;
            if (width < 640) setCardsPerPage(1);
            else if (width < 1024) setCardsPerPage(2);
            else setCardsPerPage(4);
        };
        updateCardsPerPage();
        window.addEventListener('resize', updateCardsPerPage);
        return () => window.removeEventListener('resize', updateCardsPerPage);
    }, []);

    // Reset page when cardsPerPage changes
    useEffect(() => {
        setCurrentPage(0);
    }, [cardsPerPage]);

    const totalPages = Math.ceil(doctors.length / cardsPerPage);

    // Auto-rotate every 3 seconds
    useEffect(() => {
        if (totalPages <= 1 || isHovered) return;
        const interval = setInterval(() => {
            setCurrentPage((prev) => (prev + 1) % totalPages);
        }, 3000);
        return () => clearInterval(interval);
    }, [totalPages, isHovered]);

    // Scroll to current page
    useEffect(() => {
        if (!carouselRef.current) return;
        const pageWidth = carouselRef.current.clientWidth;
        carouselRef.current.scrollTo({
            left: pageWidth * currentPage,
            behavior: "smooth",
        });
    }, [currentPage]);

    const goToPage = (page) => setCurrentPage(page);
    const goNext = () => setCurrentPage((prev) => (prev + 1) % totalPages);
    const goPrev = () =>
        setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);

    // Pluralize years
    const getYearWord = (years) => {
        if (years === 1) return "год";
        if (years >= 2 && years <= 4) return "года";
        return "лет";
    };

    return (
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
                    <div className='flex items-center gap-3'>
                        {totalPages > 1 && (
                            <>
                                <button
                                    onClick={goPrev}
                                    className='w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 transition-colors'>
                                    <ChevronLeft className='w-5 h-5' />
                                </button>
                                <button
                                    onClick={goNext}
                                    className='w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-600 transition-colors'>
                                    <ArrowRight className='w-5 h-5' />
                                </button>
                            </>
                        )}
                        <Link to='/doctors'>
                            <Button
                                variant='outline'
                                rightIcon={<ArrowRight className='w-4 h-4' />}>
                                Все врачи
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Carousel */}
                <div
                    className='relative'
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}>
                    <div
                        ref={carouselRef}
                        className='overflow-hidden scroll-smooth'
                        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                        onTouchEnd={(e) => {
                            if (touchStartX.current === null) return;
                            const diff = touchStartX.current - e.changedTouches[0].clientX;
                            if (Math.abs(diff) > 50) {
                                if (diff > 0) goNext();
                                else goPrev();
                            }
                            touchStartX.current = null;
                        }}>
                        <div
                            className='flex'
                            style={{
                                width: `${totalPages * 100}%`,
                            }}>
                            {doctors.map((doctor) => {
                                const specName =
                                    typeof doctor.specialization === "object"
                                        ? doctor.specialization?.name
                                        : doctor.specialization || "Специалист";
                                const photoUrl = getMediaUrl(doctor.photo);
                                const initials = getInitials(doctor.fullName);
                                const colorIndex = doctor.fullName
                                    ? doctor.fullName.charCodeAt(0) %
                                      doctorCardColors.length
                                    : 0;
                                const bgColor = doctorCardColors[colorIndex];
                                const rating = Math.min(doctor.rating || 0, 5);
                                const reviewsCount = doctor.reviewsCount || 0;
                                const experience = doctor.experience || 0;
                                const isOnline = isDoctorOnline(doctor);
                                const recommendPercent =
                                    reviewsCount > 0
                                        ? Math.min(95 + Math.floor(rating), 100)
                                        : null;

                                return (
                                    <div
                                        key={doctor.id || doctor.documentId}
                                        className='px-3'
                                        style={{
                                            width: `${100 / (totalPages * cardsPerPage)}%`,
                                        }}>
                                        <Link
                                            to={`/doctors/${doctor.documentId || doctor.id}`}
                                            className='group block h-full'>
                                            <div className='bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-slate-200 hover:-translate-y-1 h-full flex flex-col'>
                                                {/* Photo Section */}
                                                <div className='relative'>
                                                    <div className='aspect-square sm:aspect-[4/5] overflow-hidden bg-slate-100'>
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={
                                                                    doctor.fullName
                                                                }
                                                                className='w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105'
                                                            />
                                                        ) : (
                                                            <div
                                                                className={cn(
                                                                    "w-full h-full flex items-center justify-center text-white text-4xl font-bold",
                                                                    bgColor,
                                                                )}>
                                                                {initials}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Online indicator */}
                                                    {isOnline && (
                                                        <span className='absolute bottom-3 right-3 px-2.5 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center gap-1.5 shadow-lg'>
                                                            <span className='w-1.5 h-1.5 bg-white rounded-full animate-pulse' />
                                                            Онлайн
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info Section */}
                                                <div className='p-5 flex flex-col flex-1'>
                                                    <div className='mb-3'>
                                                        <h3 className='text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors line-clamp-1'>
                                                            {doctor.fullName}
                                                        </h3>
                                                        <p className='text-teal-600 font-medium text-sm'>
                                                            {specName}
                                                        </p>
                                                    </div>

                                                    {/* Stats Row */}
                                                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1 mb-3'>
                                                        <div className='flex items-center gap-1'>
                                                            <Star className='w-4 h-4 text-amber-400 fill-amber-400' />
                                                            <span className='font-semibold text-slate-900'>
                                                                {rating.toFixed(
                                                                    1,
                                                                )}
                                                            </span>
                                                            <span className='text-slate-500 text-sm'>
                                                                ({reviewsCount})
                                                            </span>
                                                        </div>
                                                        <div className='flex items-center gap-1 text-slate-600 text-sm'>
                                                            <Clock className='w-4 h-4' />
                                                            <span>
                                                                {experience}{" "}
                                                                {getYearWord(
                                                                    experience,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Recommendation Badge */}
                                                    <div className='h-6 mb-3'>
                                                        {recommendPercent && (
                                                            <div className='flex items-center gap-1.5'>
                                                                <ThumbsUp className='w-4 h-4 text-emerald-500' />
                                                                <span className='text-sm text-emerald-600 font-medium'>
                                                                    {
                                                                        recommendPercent
                                                                    }
                                                                    %
                                                                    рекомендуют
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Price and Action */}
                                                    <div className='flex items-center justify-between pt-4 border-t border-slate-100 mt-auto'>
                                                        <div>
                                                            <p className='text-xl font-bold text-slate-900'>
                                                                {(
                                                                    doctor.price ||
                                                                    0
                                                                ).toLocaleString(
                                                                    "ru-RU",
                                                                )}{" "}
                                                                ₸
                                                            </p>
                                                            <p className='text-xs text-slate-500'>
                                                                за консультацию
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size='sm'
                                                            className='pointer-events-none'>
                                                            Записаться
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Pagination dots */}
                {totalPages > 1 && (
                    <div className='flex items-center justify-center gap-2 mt-8'>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToPage(i)}
                                className={cn(
                                    "h-2 rounded-full transition-all duration-300",
                                    currentPage === i
                                        ? "w-8 bg-teal-500"
                                        : "w-2 bg-slate-300 hover:bg-slate-400",
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

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
    const [landingContent, setLandingContent] = useState({
        siteName: "MedConnect",
        siteDescription:
            "Получите квалифицированную медицинскую помощь не выходя из дома.",
        config: defaultLandingConfig,
    });

    // 3D Card Effect State
    const cardRef = useRef(null);
    const [cardTransform, setCardTransform] = useState({
        rotateX: 0,
        rotateY: 0,
        scale: 1,
    });

    const handleCardMouseMove = (e) => {
        if (!cardRef.current) return;
        const card = cardRef.current;
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;

        // Calculate rotation (max 15 degrees)
        const rotateY = (mouseX / (rect.width / 2)) * 12;
        const rotateX = -(mouseY / (rect.height / 2)) * 12;

        setCardTransform({ rotateX, rotateY, scale: 1.02 });
    };

    const handleCardMouseLeave = () => {
        setCardTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Загружаем врачей
                const [doctorsRes, specsRes] = await Promise.all([
                    doctorsAPI.getAll(),
                    specializationsAPI.getAll(),
                ]);
                const { data: doctorsData } = normalizeResponse(doctorsRes);
                const { data: specsData } = normalizeResponse(specsRes);

                // Подсчитываем статистику
                const totalDoctors = doctorsData?.length || 0;
                const avgRating = doctorsData?.length
                    ? (
                          doctorsData.reduce(
                              (sum, d) => sum + (d.rating || 0),
                              0,
                          ) / doctorsData.length
                      ).toFixed(1)
                    : 0;

                setStats({
                    consultations: totalDoctors * 100 + 500,
                    doctors: totalDoctors,
                    avgRating: avgRating,
                    satisfaction: 98,
                });

                setDoctors(doctorsData?.slice(0, 8) || []);
                setSpecializations(specsData?.slice(0, 6) || []);

                // Загружаем редактируемый контент лендинга из Strapi
                const globalRes = await contentAPI.getGlobal();
                const { data: globalData } = normalizeResponse(globalRes);
                const incomingConfig = globalData?.landingConfig || {};
                const mergedConfig = {
                    ...defaultLandingConfig,
                    ...incomingConfig,
                    hero: { ...defaultLandingConfig.hero, ...(incomingConfig.hero || {}) },
                    heroCard: {
                        ...defaultLandingConfig.heroCard,
                        ...(incomingConfig.heroCard || {}),
                        items:
                            Array.isArray(incomingConfig.heroCard?.items) &&
                            incomingConfig.heroCard.items.length > 0
                                ? incomingConfig.heroCard.items
                                : defaultLandingConfig.heroCard.items,
                    },
                    stats:
                        Array.isArray(incomingConfig.stats) &&
                        incomingConfig.stats.length > 0
                            ? incomingConfig.stats
                            : defaultLandingConfig.stats,
                    featuresSection: {
                        ...defaultLandingConfig.featuresSection,
                        ...(incomingConfig.featuresSection || {}),
                        cards:
                            Array.isArray(incomingConfig.featuresSection?.cards) &&
                            incomingConfig.featuresSection.cards.length > 0
                                ? incomingConfig.featuresSection.cards
                                : defaultLandingConfig.featuresSection.cards,
                    },
                    stepsSection: {
                        ...defaultLandingConfig.stepsSection,
                        ...(incomingConfig.stepsSection || {}),
                        steps:
                            Array.isArray(incomingConfig.stepsSection?.steps) &&
                            incomingConfig.stepsSection.steps.length > 0
                                ? incomingConfig.stepsSection.steps
                                : defaultLandingConfig.stepsSection.steps,
                    },
                    aboutSection: {
                        ...defaultLandingConfig.aboutSection,
                        ...(incomingConfig.aboutSection || {}),
                        bullets:
                            Array.isArray(incomingConfig.aboutSection?.bullets) &&
                            incomingConfig.aboutSection.bullets.length > 0
                                ? incomingConfig.aboutSection.bullets
                                : defaultLandingConfig.aboutSection.bullets,
                    },
                    contactSection: {
                        ...defaultLandingConfig.contactSection,
                        ...(incomingConfig.contactSection || {}),
                        phone: {
                            ...defaultLandingConfig.contactSection.phone,
                            ...(incomingConfig.contactSection?.phone || {}),
                        },
                        email: {
                            ...defaultLandingConfig.contactSection.email,
                            ...(incomingConfig.contactSection?.email || {}),
                        },
                        address: {
                            ...defaultLandingConfig.contactSection.address,
                            ...(incomingConfig.contactSection?.address || {}),
                        },
                        quickCard: {
                            ...defaultLandingConfig.contactSection.quickCard,
                            ...(incomingConfig.contactSection?.quickCard || {}),
                            bullets:
                                Array.isArray(incomingConfig.contactSection?.quickCard?.bullets) &&
                                incomingConfig.contactSection.quickCard.bullets.length > 0
                                    ? incomingConfig.contactSection.quickCard.bullets
                                    : defaultLandingConfig.contactSection.quickCard.bullets,
                        },
                    },
                };

                setLandingContent((prev) => ({
                    ...prev,
                    siteName: globalData?.siteName || prev.siteName,
                    siteDescription:
                        globalData?.siteDescription || prev.siteDescription,
                    config: mergedConfig,
                }));
            } catch (error) {
                console.error("Error fetching landing data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const config = landingContent.config || defaultLandingConfig;

    return (
        <div className='overflow-hidden'>
            {/* Hero Section */}
            <section className='relative min-h-screen flex items-center'>
                {/* Background Image */}
                <div className='absolute inset-0'>
                    <img
                        src='/background.png'
                        alt=''
                        className='w-full h-full object-cover'
                    />
                    <div className='absolute inset-0 bg-gradient-to-r from-teal-800/85 via-teal-700/75 to-sky-800/65' />
                </div>
                {/* Background Effects */}
                <div className='absolute inset-0 overflow-hidden pointer-events-none'>
                    <div className='absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl' />
                    <div className='absolute bottom-20 right-20 w-96 h-96 bg-sky-300/10 rounded-full blur-3xl' />
                </div>

                <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium mb-6 backdrop-blur-sm border border-white/20'>
                                <Zap className='w-4 h-4 text-amber-400' />
                                {config.hero.badge}
                            </span>
                            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6'>
                                {config.hero.titlePrefix}{" "}
                                <span className='text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-200'>
                                    {config.hero.titleHighlight}
                                </span>
                            </h1>
                            <p className='text-xl text-white/80 mb-8 max-w-lg leading-relaxed'>
                                {config.hero.description}
                            </p>
                            <div className='flex flex-col sm:flex-row gap-4'>
                                <Link to='/doctors'>
                                    <Button
                                        size='lg'
                                        className=' text-teal-700 hover:bg-teal-50 shadow-lg shadow-black/10 font-semibold'>
                                        {config.hero.primaryButtonLabel}
                                        <ArrowRight className='w-5 h-5 ml-2' />
                                    </Button>
                                </Link>
                                <Link to='/register'>
                                    <Button
                                        size='lg'
                                        className='bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg font-semibold'>
                                        {config.hero.secondaryButtonLabel}
                                    </Button>
                                </Link>
                            </div>

                            {/* Stats */}
                            <div className='grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-12 border-t border-white/20'>
                                {(config.stats || []).slice(0, 4).map((item, idx) => (
                                    <div key={idx}>
                                        <div className='text-3xl font-bold text-white'>
                                            {item.value}
                                        </div>
                                        <div className='text-sm text-white/60'>
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Content - 3D Floating Card */}
                        <div
                            className='hidden lg:block relative'
                            style={{ perspective: "1000px" }}>
                            <div className='absolute -top-10 -right-10 w-72 h-72 bg-teal-500/30 rounded-full blur-3xl' />
                            <div
                                ref={cardRef}
                                onMouseMove={handleCardMouseMove}
                                onMouseLeave={handleCardMouseLeave}
                                className='relative'
                                style={{
                                    transform: `rotateX(${cardTransform.rotateX}deg) rotateY(${cardTransform.rotateY}deg) scale(${cardTransform.scale})`,
                                    transition: "transform 0.15s ease-out",
                                    transformStyle: "preserve-3d",
                                }}>
                                <Card className='relative bg-white/70 backdrop-blur-md shadow-2xl border-0 overflow-hidden'>
                                    {/* Shine effect */}
                                    <div
                                        className='absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none'
                                        style={{
                                            background: `linear-gradient(
                                                ${105 + cardTransform.rotateY * 2}deg,
                                                transparent 40%,
                                                rgba(255,255,255,0.1) 45%,
                                                rgba(255,255,255,0.3) 50%,
                                                rgba(255,255,255,0.1) 55%,
                                                transparent 60%
                                            )`,
                                        }}
                                    />
                                    <CardContent className='p-8'>
                                        <div className='flex items-center gap-4 mb-6'>
                                            <div
                                                className='w-16 h-16 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg'
                                                style={{
                                                    transform:
                                                        "translateZ(30px)",
                                                }}>
                                                <Video className='w-8 h-8 text-white' />
                                            </div>
                                            <div
                                                style={{
                                                    transform:
                                                        "translateZ(20px)",
                                                }}>
                                                <h3 className='text-lg font-semibold text-slate-900'>
                                                    {config.heroCard.title}
                                                </h3>
                                                <p className='text-slate-500'>
                                                    {config.heroCard.subtitle}
                                                </p>
                                            </div>
                                        </div>

                                        <div className='space-y-4 mb-6'>
                                            {(config.heroCard.items || []).slice(0, 3).map((adv, idx) => {
                                                const AdvantageIcon =
                                                    advantageIcons[idx] ||
                                                    advantageIcons[0];
                                                return (
                                                <div
                                                    key={idx}
                                                    className='flex items-center gap-3'
                                                    style={{
                                                        transform: `translateZ(${15 - idx * 3}px)`,
                                                    }}>
                                                    <div className='w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0'>
                                                        <AdvantageIcon className='w-5 h-5 text-teal-600' />
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
                                                );
                                            })}
                                        </div>

                                        <Link
                                            to='/doctors'
                                            className='block'
                                            style={{
                                                transform: "translateZ(25px)",
                                            }}>
                                            <Button className='w-full'>
                                                {config.heroCard.buttonLabel}
                                            </Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            </div>
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
                            {config.featuresSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.featuresSection.title}
                        </h2>
                        <p className='text-xl text-slate-600 max-w-2xl mx-auto'>
                            {config.featuresSection.subtitle}
                        </p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {(config.featuresSection.cards || [])
                            .slice(0, 4)
                            .map((feature, index) => {
                                const FeatureIcon =
                                    featureIcons[index] || featureIcons[0];
                                return (
                                    <Card
                                        key={index}
                                        hover
                                        className='text-center border-0 shadow-lg shadow-slate-200/50'>
                                        <CardContent className='pt-8'>
                                            <div className='w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30'>
                                                <FeatureIcon className='w-8 h-8 text-white' />
                                            </div>
                                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                                                {feature.title}
                                            </h3>
                                            <p className='text-slate-600'>
                                                {feature.description}
                                            </p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
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
                            {config.stepsSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.stepsSection.title}
                        </h2>
                        <p className='text-xl text-slate-600'>
                            {config.stepsSection.subtitle}
                        </p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {(config.stepsSection.steps || [])
                            .slice(0, 4)
                            .map((step, index) => (
                            <div
                                key={index}
                                className='relative text-center lg:text-left'>
                                <div className='text-7xl font-bold text-teal-100 mb-4'>
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <h3 className='text-xl font-semibold text-slate-900 mb-2'>
                                    {step.title}
                                </h3>
                                <p className='text-slate-600'>
                                    {step.description}
                                </p>
                                {index <
                                    (config.stepsSection.steps || []).slice(
                                        0,
                                        4,
                                    ).length -
                                        1 && (
                                    <ArrowRight className='hidden lg:block absolute top-8 -right-4 w-8 h-8 text-teal-300' />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Top Doctors Carousel Section */}
            {doctors.length > 0 && <DoctorsCarousel doctors={doctors} />}

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
                                            ),
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
                                {config.aboutSection.badge}
                            </span>
                            <h2 className='text-3xl sm:text-4xl font-bold mb-6'>
                                {config.aboutSection.title}
                            </h2>
                            <p className='text-white/80 text-lg mb-6 leading-relaxed'>
                                {config.aboutSection.description}
                            </p>
                            <div className='space-y-4 mb-8'>
                                {(config.aboutSection.bullets || []).map(
                                    (item, idx) => (
                                        <div
                                            className='flex items-center gap-3'
                                            key={idx}>
                                            <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                            <span className='text-white/90'>
                                                {item}
                                            </span>
                                        </div>
                                    ),
                                )}
                            </div>
                            <Link to='/register'>
                                <Button
                                    size='lg'
                                    className=' text-teal-700 hover:bg-teal-50'>
                                    {config.aboutSection.buttonLabel}
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
                                            {config.stats?.[0]?.value}
                                        </div>
                                        <p className='text-white/70'>
                                            {config.stats?.[0]?.label}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Award className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {config.stats?.[2]?.value}
                                        </div>
                                        <p className='text-white/70'>
                                            {config.stats?.[2]?.label}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Stethoscope className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {config.stats?.[1]?.value}
                                        </div>
                                        <p className='text-white/70'>
                                            {config.stats?.[1]?.label}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Heart className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>
                                            {config.stats?.[3]?.value}
                                        </div>
                                        <p className='text-white/70'>
                                            {config.stats?.[3]?.label}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id='contact' className='py-24 bg-slate-50'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {config.contactSection.badge}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {config.contactSection.title}
                        </h2>
                        <p className='text-xl text-slate-600 max-w-2xl mx-auto'>
                            {config.contactSection.subtitle}
                        </p>
                    </div>

                    <div className='grid lg:grid-cols-3 gap-8 mb-12'>
                        {/* Phone */}
                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-500 transition-colors'>
                                <Phone className='w-7 h-7 text-teal-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                                {config.contactSection.phone.title}
                            </h3>
                            <p className='text-slate-500 text-sm mb-4'>
                                {config.contactSection.phone.note}
                            </p>
                            <a
                                href={`tel:${(config.contactSection.phone.value || "")
                                    .replace(/\\s+/g, "")
                                    .replace(/[()\\-]/g, "")}`}
                                className='text-xl font-semibold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.phone.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        {/* Email */}
                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-500 transition-colors'>
                                <Mail className='w-7 h-7 text-sky-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                                {config.contactSection.email.title}
                            </h3>
                            <p className='text-slate-500 text-sm mb-4'>
                                {config.contactSection.email.note}
                            </p>
                            <a
                                href={`mailto:${config.contactSection.email.value}`}
                                className='text-xl font-semibold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.email.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        {/* Address */}
                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-violet-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-500 transition-colors'>
                                <MapPin className='w-7 h-7 text-violet-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>
                                {config.contactSection.address.title}
                            </h3>
                            <p className='text-slate-500 text-sm mb-4'>
                                {config.contactSection.address.note}
                            </p>
                            <p className='text-xl font-semibold text-violet-600'>
                                {config.contactSection.address.value}
                            </p>
                        </div>
                    </div>

                    {/* Map + Quick Contact CTA */}
                    <div className='grid lg:grid-cols-5 gap-8'>
                        {/* Map placeholder */}
                        <div className='lg:col-span-3 rounded-2xl overflow-hidden shadow-lg border border-slate-200 min-h-[320px]'>
                            <iframe
                                title='MedConnect Location'
                                src={config.contactSection.mapEmbedUrl}
                                width='100%'
                                height='100%'
                                style={{ border: 0, minHeight: "320px" }}
                                allowFullScreen=''
                                loading='lazy'
                                referrerPolicy='no-referrer-when-downgrade'
                                className='w-full h-full'
                            />
                        </div>

                        {/* Quick contact card */}
                        <div className='lg:col-span-2 bg-gradient-to-br from-teal-600 to-sky-700 rounded-2xl p-8 text-white flex flex-col justify-between'>
                            <div>
                                <h3 className='text-2xl font-bold mb-4'>
                                    {config.contactSection.quickCard.title}
                                </h3>
                                <p className='text-white/80 mb-6 leading-relaxed'>
                                    {config.contactSection.quickCard.description}
                                </p>
                                <div className='space-y-3 mb-8'>
                                    {(config.contactSection.quickCard.bullets ||
                                        []).map((item, idx) => (
                                        <div
                                            className='flex items-center gap-3'
                                            key={idx}>
                                            <CheckCircle className='w-5 h-5 text-teal-300 flex-shrink-0' />
                                            <span className='text-white/90 text-sm'>
                                                {item}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Link to='/doctors'>
                                <Button
                                    size='lg'
                                    className='w-full  text-teal-700 hover:bg-teal-50 shadow-lg'
                                    rightIcon={<Send className='w-5 h-5' />}>
                                    {config.contactSection.quickCard.buttonLabel}
                                </Button>
                            </Link>
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
