import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import SEOHead from "../components/seo/SEOHead";
import { useTranslation } from "react-i18next";
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
    Loader2,
    Phone,
    Mail,
    MapPin,
    Building2,
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
import { cn, getInitials, isDoctorOnline, getSpecName } from "../utils/helpers";

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

const specializationIcons = {
    Терапевт: Stethoscope,
    Кардиолог: Heart,
    Невролог: Brain,
    Офтальмолог: Eye,
    Педиатр: Baby,
    Эндокринолог: Pill,
    default: Stethoscope,
};

function CinematicHero({ config, t }) {
    const sectionRef = useRef(null);
    const videoRef = useRef(null);
    const cardRef = useRef(null);
    const pointerFrameRef = useRef(null);
    const [cardTransform, setCardTransform] = useState({
        rotateX: 0,
        rotateY: 0,
        scale: 1,
    });

    useEffect(() => {
        const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

        const syncMotionPreference = () => {
            const video = videoRef.current;
            if (!video) return;

            if (motionPreference.matches) {
                video.pause();
            } else if (video.paused) {
                video.play().catch(() => {});
            }
        };

        syncMotionPreference();
        motionPreference.addEventListener?.("change", syncMotionPreference);

        return () => {
            motionPreference.removeEventListener?.("change", syncMotionPreference);
            if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
        };
    }, []);

    const handleHeroPointerMove = (event) => {
        if (!sectionRef.current || event.pointerType === "touch") return;
        const { clientX, clientY } = event;

        if (pointerFrameRef.current) cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = requestAnimationFrame(() => {
            if (!sectionRef.current) return;
            const rect = sectionRef.current.getBoundingClientRect();
            const x = (clientX - rect.left) / rect.width - 0.5;
            const y = (clientY - rect.top) / rect.height - 0.5;
            sectionRef.current.style.setProperty("--hero-video-x", `${x * -18}px`);
            sectionRef.current.style.setProperty("--hero-video-y", `${y * -12}px`);
            sectionRef.current.style.setProperty("--hero-glow-x", `${x * 34}px`);
            sectionRef.current.style.setProperty("--hero-glow-y", `${y * 24}px`);
        });
    };

    const resetHeroPointer = () => {
        if (!sectionRef.current) return;
        sectionRef.current.style.setProperty("--hero-video-x", "0px");
        sectionRef.current.style.setProperty("--hero-video-y", "0px");
        sectionRef.current.style.setProperty("--hero-glow-x", "0px");
        sectionRef.current.style.setProperty("--hero-glow-y", "0px");
    };

    const handleCardPointerMove = (event) => {
        if (!cardRef.current || event.pointerType === "touch") return;
        const rect = cardRef.current.getBoundingClientRect();
        const mouseX = event.clientX - (rect.left + rect.width / 2);
        const mouseY = event.clientY - (rect.top + rect.height / 2);
        setCardTransform({
            rotateX: -(mouseY / (rect.height / 2)) * 5,
            rotateY: (mouseX / (rect.width / 2)) * 6,
            scale: 1.012,
        });
    };

    const resetCardTransform = () => {
        setCardTransform({ rotateX: 0, rotateY: 0, scale: 1 });
    };

    return (
        <section
            ref={sectionRef}
            aria-labelledby='landing-hero-title'
            className='hero-cinematic relative min-h-[100svh] overflow-hidden bg-slate-950'
            onPointerMove={handleHeroPointerMove}
            onPointerLeave={resetHeroPointer}>
            <div className='absolute inset-0' aria-hidden='true'>
                <video
                    ref={videoRef}
                    className='hero-cinematic__video h-full w-full object-cover'
                    src='/nnmc-campus-hero.mp4'
                    poster='/nnmc-campus-hero-poster.jpg'
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload='metadata'
                />
                <div className='hero-cinematic__scrim absolute inset-0' />
                <div className='hero-cinematic__aurora absolute inset-0' />
                <div className='hero-cinematic__grid absolute inset-0' />
                <div className='hero-cinematic__vignette absolute inset-0' />
            </div>

            <div className='relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-center px-4 pb-24 pt-28 sm:px-6 sm:pb-28 sm:pt-32 lg:px-8'>
                <div className='grid w-full items-end gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.72fr)] lg:gap-16'>
                    <div className='text-white'>
                        <span className='hero-enter hero-enter--1 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium shadow-lg shadow-black/10 backdrop-blur-md'>
                            <span className='relative flex h-2.5 w-2.5'>
                                <span className='hero-cinematic__status-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-70' />
                                <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300' />
                            </span>
                            {config.hero.badge}
                        </span>

                        <h1
                            id='landing-hero-title'
                            className='hero-enter hero-enter--2 mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[4.25rem]'>
                            {config.hero.titlePrefix}{" "}
                            <span className='hero-cinematic__highlight text-transparent bg-clip-text'>
                                {config.hero.titleHighlight}
                            </span>
                        </h1>

                        <p className='hero-enter hero-enter--3 mt-6 max-w-xl text-lg leading-relaxed text-white/75 sm:text-xl'>
                            {config.hero.description}
                        </p>

                        <div className='hero-enter hero-enter--4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
                            <Link to='/doctors' className='group'>
                                <Button
                                    size='lg'
                                    className='hero-cinematic__primary-cta w-full bg-white text-teal-900 shadow-xl shadow-black/20 hover:bg-teal-50 sm:w-auto'>
                                    {config.hero.primaryButtonLabel}
                                    <ArrowRight className='ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1' />
                                </Button>
                            </Link>
                            <Link to='/register'>
                                <Button
                                    size='lg'
                                    className='w-full border border-white/25 bg-white/10 text-white shadow-lg shadow-black/10 backdrop-blur-md hover:bg-white/20 sm:w-auto'>
                                    {config.hero.secondaryButtonLabel}
                                </Button>
                            </Link>
                        </div>

                        <div className='hero-enter hero-enter--5 mt-10 grid max-w-2xl grid-cols-2 gap-x-7 gap-y-5 border-t border-white/15 pt-8 sm:grid-cols-4'>
                            {(config.stats || []).slice(0, 4).map((item, idx) => (
                                <div key={`${item.label}-${idx}`}>
                                    <div className='text-2xl font-bold tracking-tight text-white sm:text-3xl'>{item.value}</div>
                                    <div className='mt-1 text-xs leading-snug text-white/55 sm:text-sm'>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='hero-enter hero-enter--4 hidden lg:block' style={{ perspective: "1200px" }}>
                        <div
                            ref={cardRef}
                            onPointerMove={handleCardPointerMove}
                            onPointerLeave={resetCardTransform}
                            className='hero-cinematic__card relative overflow-hidden rounded-[1.75rem] border border-white/20 bg-slate-950/35 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl'
                            style={{
                                transform: `rotateX(${cardTransform.rotateX}deg) rotateY(${cardTransform.rotateY}deg) scale(${cardTransform.scale})`,
                                transition: "transform 160ms ease-out",
                                transformStyle: "preserve-3d",
                            }}>
                            <div className='hero-cinematic__card-glow pointer-events-none absolute inset-0' />

                            <div className='relative' style={{ transform: "translateZ(20px)" }}>
                                <div className='mb-6 flex items-center gap-3'>
                                    <div className='flex items-center gap-3'>
                                        <div className='flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10'>
                                            <Building2 className='h-5 w-5 text-teal-200' />
                                        </div>
                                        <div>
                                            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-teal-200'>NNMC campus</p>
                                            <p className='mt-0.5 text-sm text-white/55'>{config.heroCard.subtitle}</p>
                                        </div>
                                    </div>
                                </div>

                                <h2 className='max-w-sm text-2xl font-semibold leading-tight text-white'>
                                    {config.heroCard.title}
                                </h2>

                                <div className='mt-5 space-y-2.5'>
                                    {(config.heroCard.items || []).slice(0, 3).map((item, idx) => {
                                        const AdvantageIcon = advantageIcons[idx] || advantageIcons[0];
                                        return (
                                            <div key={`${item.title}-${idx}`} className='flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-3'>
                                                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-300/15'>
                                                    <AdvantageIcon className='h-4 w-4 text-teal-200' />
                                                </div>
                                                <div className='min-w-0'>
                                                    <p className='truncate text-sm font-medium text-white/90'>{item.title}</p>
                                                    <p className='truncate text-xs text-white/45'>{item.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <Link to='/doctors' className='mt-6 block'>
                                    <Button className='w-full bg-teal-400 text-teal-950 shadow-none hover:bg-teal-300'>
                                        {config.heroCard.buttonLabel}
                                        <ArrowRight className='ml-2 h-4 w-4' />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button
                type='button'
                onClick={() => document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" })}
                className='hero-scroll-cue absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-white/55 transition-colors hover:text-white sm:bottom-7'
                aria-label={t('landing.hero.scroll_more')}>
                <span className='hidden text-[11px] font-semibold uppercase tracking-[0.18em] sm:block'>{t('landing.hero.scroll_more')}</span>
                <span className='flex h-9 w-6 justify-center rounded-full border border-white/30 p-1.5'>
                    <span className='hero-scroll-cue__dot h-1.5 w-1.5 rounded-full bg-white/70' />
                </span>
            </button>
        </section>
    );
}



// Doctors Carousel Component
function DoctorsCarousel({ doctors }) {
    const { t, i18n } = useTranslation();
    const carouselRef = useRef(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const touchStartX = useRef(null);
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

    useEffect(() => {
        setCurrentPage(0);
    }, [cardsPerPage]);

    const totalPages = Math.ceil(doctors.length / cardsPerPage);

    useEffect(() => {
        if (totalPages <= 1 || isHovered) return;
        const interval = setInterval(() => {
            setCurrentPage((prev) => (prev + 1) % totalPages);
        }, 3000);
        return () => clearInterval(interval);
    }, [totalPages, isHovered]);

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

    const getYearWord = (years) => {
        if (years === 1) return t('common.year_1');
        if (years >= 2 && years <= 4) return t('common.year_2_4');
        return t('common.year_many');
    };

    return (
        <section className='py-24 bg-gradient-to-b from-slate-50 to-white'>
            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex flex-col sm:flex-row items-center justify-between mb-12 gap-4'>
                    <div className='text-center sm:text-left'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.doctors.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-2'>
                            {t('landing.doctors.title')}
                        </h2>
                        <p className='text-slate-600'>
                            {t('landing.doctors.subtitle')}
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
                                {t('landing.doctors.all_doctors')}
                            </Button>
                        </Link>
                    </div>
                </div>

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
                            style={{ width: `${totalPages * 100}%` }}>
                            {doctors.map((doctor) => {
                                const specName = getSpecName(doctor.specialization, i18n.language)
                                    || t('common.specialist');
                                const photoUrl = getMediaUrl(doctor.photo);
                                const initials = getInitials(doctor.fullName);
                                const colorIndex = doctor.fullName
                                    ? doctor.fullName.charCodeAt(0) % doctorCardColors.length
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
                                                <div className='relative'>
                                                    <div className='aspect-square sm:aspect-[4/5] overflow-hidden bg-slate-100'>
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={doctor.fullName}
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
                                                    {isOnline && (
                                                        <span className='absolute bottom-3 right-3 px-2.5 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center gap-1.5 shadow-lg'>
                                                            <span className='w-1.5 h-1.5 bg-white rounded-full animate-pulse' />
                                                            {t('common.online')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className='p-5 flex flex-col flex-1'>
                                                    <div className='mb-3'>
                                                        <h3 className='text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors line-clamp-1'>
                                                            {doctor.fullName}
                                                        </h3>
                                                        <p className='text-teal-600 font-medium text-sm'>
                                                            {specName}
                                                        </p>
                                                    </div>

                                                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1 mb-3'>
                                                        <div className='flex items-center gap-1'>
                                                            <Star className='w-4 h-4 text-amber-400 fill-amber-400' />
                                                            <span className='font-semibold text-slate-900'>
                                                                {rating.toFixed(1)}
                                                            </span>
                                                            <span className='text-slate-500 text-sm'>
                                                                ({reviewsCount})
                                                            </span>
                                                        </div>
                                                        <div className='flex items-center gap-1 text-slate-600 text-sm'>
                                                            <Clock className='w-4 h-4' />
                                                            <span>
                                                                {experience}{" "}
                                                                {getYearWord(experience)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className='h-6 mb-3'>
                                                        {recommendPercent && (
                                                            <div className='flex items-center gap-1.5'>
                                                                <ThumbsUp className='w-4 h-4 text-emerald-500' />
                                                                <span className='text-sm text-emerald-600 font-medium'>
                                                                    {recommendPercent}{t('common.recommend_pct')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className='flex items-center justify-between pt-4 border-t border-slate-100 mt-auto'>
                                                        <div>
                                                            <p className='text-xl font-bold text-slate-900'>
                                                                {(doctor.price || 0).toLocaleString("ru-RU")}{" "}
                                                                {t('common.currency')}
                                                            </p>
                                                            <p className='text-xs text-slate-500'>
                                                                {t('common.price_per_consultation')}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size='sm'
                                                            className='pointer-events-none'>
                                                            {t('landing.doctors.book')}
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
    const { t, i18n } = useTranslation();

    const seoStructuredData = {
      "@context": "https://schema.org",
      "@type": "MedicalOrganization",
      "name": "MedConnect ННМЦ",
      "url": "https://medconnect.nnmc.kz",
      "description": "Платформа телемедицины Национального научного медицинского центра. Онлайн-консультации с врачами-специалистами.",
      "medicalSpecialty": ["Cardiology","Neurology","Pediatrics","Dermatology","Endocrinology"],
      "areaServed": { "@type": "Country", "name": "Kazakhstan" },
    };

    const [doctors, setDoctors] = useState([]);
    const [specializations, setSpecializations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [landingContent, setLandingContent] = useState(null);

    const defaultLandingConfig = useMemo(() => ({
        hero: {
            badge: t('landing.hero.badge'),
            titlePrefix: t('landing.hero.title_prefix'),
            titleHighlight: t('landing.hero.title_highlight'),
            description: t('landing.hero.description'),
            primaryButtonLabel: t('landing.hero.find_doctor'),
            secondaryButtonLabel: t('landing.hero.register'),
        },
        heroCard: {
            title: t('landing.hero_card.title'),
            subtitle: t('landing.hero_card.subtitle'),
            items: [
                { title: t('landing.hero_card.item_0_title'), description: t('landing.hero_card.item_0_desc') },
                { title: t('landing.hero_card.item_1_title'), description: t('landing.hero_card.item_1_desc') },
                { title: t('landing.hero_card.item_2_title'), description: t('landing.hero_card.item_2_desc') },
            ],
            buttonLabel: t('landing.hero_card.book_now'),
        },
        stats: [
            { value: "1100+", label: t('landing.stats.consultations') },
            { value: "6+", label: t('landing.stats.doctors') },
            { value: "4.9", label: t('landing.stats.avg_rating') },
            { value: "98%", label: t('landing.stats.satisfaction') },
        ],
        featuresSection: {
            badge: t('landing.features.badge'),
            title: t('landing.features.title'),
            subtitle: t('landing.features.subtitle'),
            cards: [
                { title: t('landing.features.card_0_title'), description: t('landing.features.card_0_desc') },
                { title: t('landing.features.card_1_title'), description: t('landing.features.card_1_desc') },
                { title: t('landing.features.card_2_title'), description: t('landing.features.card_2_desc') },
                { title: t('landing.features.card_3_title'), description: t('landing.features.card_3_desc') },
            ],
        },
        stepsSection: {
            badge: t('landing.steps.badge'),
            title: t('landing.steps.title'),
            subtitle: t('landing.steps.subtitle'),
            steps: [
                { title: t('landing.steps.step_0_title'), description: t('landing.steps.step_0_desc') },
                { title: t('landing.steps.step_1_title'), description: t('landing.steps.step_1_desc') },
                { title: t('landing.steps.step_2_title'), description: t('landing.steps.step_2_desc') },
                { title: t('landing.steps.step_3_title'), description: t('landing.steps.step_3_desc') },
            ],
        },
        aboutSection: {
            badge: t('landing.about.badge'),
            title: t('landing.about.title'),
            description: t('landing.about.description'),
            bullets: [
                t('landing.about.bullet_0'),
                t('landing.about.bullet_1'),
                t('landing.about.bullet_2'),
                t('landing.about.bullet_3'),
            ],
            buttonLabel: t('landing.about.join'),
        },
        contactSection: {
            badge: t('landing.contact.badge'),
            title: t('landing.contact.title'),
            subtitle: t('landing.contact.subtitle'),
            phone: {
                title: t('landing.contact.phone_title'),
                note: t('landing.contact.phone_note'),
                value: "+7 (717) 270-12-34",
            },
            email: {
                title: t('landing.contact.email_title'),
                note: t('landing.contact.email_note'),
                value: "info@medconnect.kz",
            },
            address: {
                title: t('landing.contact.address_title'),
                note: t('landing.contact.address_note'),
                value: t('footer.address'),
            },
            quickCard: {
                title: t('landing.contact.quick_title'),
                description: t('landing.contact.quick_desc'),
                bullets: [
                    t('landing.contact.quick_bullet_0'),
                    t('landing.contact.quick_bullet_1'),
                    t('landing.contact.quick_bullet_2'),
                ],
                buttonLabel: t('landing.contact.quick_button'),
            },
            mapEmbedUrl:
                "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2505.5!2d71.4926513!3d51.1492038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4245817a521995c9%3A0xe653c982ba77912!2z0J3QsNGG0LjQvtC90LDQu9GM0L3Ri9C5INC90LDRg9GH0L3Ri9C5INC80LXQtNC40YbQuNC90YHQutC40Lkg0YbQtdC90YLRgA!5e0!3m2!1sru!2skz!4v1700000000000!5m2!1sru!2skz",
        },
    }), [t]);

    const testimonials = useMemo(() => [
        { name: "Айгерим К.", text: t('landing.testimonials.review_0'), rating: 5, avatar: "АК" },
        { name: "Арман Б.", text: t('landing.testimonials.review_1'), rating: 5, avatar: "АБ" },
        { name: "Динара М.", text: t('landing.testimonials.review_2'), rating: 5, avatar: "ДМ" },
    ], [t]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [doctorsRes, specsRes] = await Promise.all([
                    doctorsAPI.getAll(),
                    specializationsAPI.getAll(),
                ]);
                const { data: doctorsData } = normalizeResponse(doctorsRes);
                const { data: specsData } = normalizeResponse(specsRes);

                setDoctors(doctorsData?.slice(0, 8) || []);
                setSpecializations(specsData?.slice(0, 6) || []);

                const globalRes = await contentAPI.getGlobal();
                const { data: globalData } = normalizeResponse(globalRes);
                setLandingContent(globalData);
            } catch (error) {
                console.error("Error fetching landing data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Merge CMS content with i18n defaults
    const incomingConfig = landingContent?.landingConfig || {};
    const config = useMemo(() => ({
        ...defaultLandingConfig,
        ...incomingConfig,
        hero: { ...defaultLandingConfig.hero, ...(incomingConfig.hero || {}) },
        heroCard: {
            ...defaultLandingConfig.heroCard,
            ...(incomingConfig.heroCard || {}),
            items:
                Array.isArray(incomingConfig.heroCard?.items) && incomingConfig.heroCard.items.length > 0
                    ? incomingConfig.heroCard.items
                    : defaultLandingConfig.heroCard.items,
        },
        stats:
            Array.isArray(incomingConfig.stats) && incomingConfig.stats.length > 0
                ? incomingConfig.stats
                : defaultLandingConfig.stats,
        featuresSection: {
            ...defaultLandingConfig.featuresSection,
            ...(incomingConfig.featuresSection || {}),
            cards:
                Array.isArray(incomingConfig.featuresSection?.cards) && incomingConfig.featuresSection.cards.length > 0
                    ? incomingConfig.featuresSection.cards
                    : defaultLandingConfig.featuresSection.cards,
        },
        stepsSection: {
            ...defaultLandingConfig.stepsSection,
            ...(incomingConfig.stepsSection || {}),
            steps:
                Array.isArray(incomingConfig.stepsSection?.steps) && incomingConfig.stepsSection.steps.length > 0
                    ? incomingConfig.stepsSection.steps
                    : defaultLandingConfig.stepsSection.steps,
        },
        aboutSection: {
            ...defaultLandingConfig.aboutSection,
            ...(incomingConfig.aboutSection || {}),
            bullets:
                Array.isArray(incomingConfig.aboutSection?.bullets) && incomingConfig.aboutSection.bullets.length > 0
                    ? incomingConfig.aboutSection.bullets
                    : defaultLandingConfig.aboutSection.bullets,
        },
        contactSection: {
            ...defaultLandingConfig.contactSection,
            ...(incomingConfig.contactSection || {}),
            phone: { ...defaultLandingConfig.contactSection.phone, ...(incomingConfig.contactSection?.phone || {}) },
            email: { ...defaultLandingConfig.contactSection.email, ...(incomingConfig.contactSection?.email || {}) },
            address: { ...defaultLandingConfig.contactSection.address, ...(incomingConfig.contactSection?.address || {}) },
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
    }), [defaultLandingConfig, incomingConfig]);

    return (
        <div className='overflow-hidden'>
            <SEOHead
                title="Телемедицина ННМЦ — Онлайн-консультации врачей"
                description="MedConnect — платформа телемедицины ННМЦ. Запишитесь на онлайн-консультацию к кардиологу, неврологу, педиатру, терапевту и другим специалистам. Видеозвонки и чат с врачом."
                url="/"
                structuredData={seoStructuredData}
            />
            <CinematicHero config={config} t={t} />

            {/* Features Section */}
            <section id='features' className='py-24 bg-white'>
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
                        {(config.featuresSection.cards || []).slice(0, 4).map((feature, index) => {
                            const FeatureIcon = featureIcons[index] || featureIcons[0];
                            return (
                                <Card key={index} hover className='text-center border-0 shadow-lg shadow-slate-200/50'>
                                    <CardContent className='pt-8'>
                                        <div className='w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30'>
                                            <FeatureIcon className='w-8 h-8 text-white' />
                                        </div>
                                        <h3 className='text-lg font-semibold text-slate-900 mb-2'>{feature.title}</h3>
                                        <p className='text-slate-600'>{feature.description}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Specializations Section */}
            <section id='specializations' className='py-24 bg-gradient-to-b from-slate-50 to-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.specializations.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {t('landing.specializations.title')}
                        </h2>
                        <p className='text-xl text-slate-600'>
                            {t('landing.specializations.subtitle')}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className='flex justify-center py-12'>
                            <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
                        </div>
                    ) : specializations.length > 0 ? (
                        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6'>
                            {specializations.map((spec) => {
                                const IconComponent = specializationIcons[spec.name] || specializationIcons.default;
                                return (
                                    <Link key={spec.id} to={`/doctors?specialization=${spec.name}`} className='group'>
                                        <Card hover className='text-center transition-all group-hover:border-teal-500 group-hover:shadow-lg'>
                                            <CardContent className='py-8'>
                                                <div className='w-16 h-16 mx-auto mb-4 bg-teal-100 rounded-2xl flex items-center justify-center group-hover:bg-teal-500 transition-colors'>
                                                    <IconComponent className='w-8 h-8 text-teal-600 group-hover:text-white transition-colors' />
                                                </div>
                                                <h3 className='font-medium text-slate-900 group-hover:text-teal-600 transition-colors'>
                                                    {getSpecName(spec, i18n.language)}
                                                </h3>
                                                {spec.doctorsCount > 0 && (
                                                    <p className='text-sm text-slate-500 mt-1'>
                                                        {t('landing.specializations.doctors_count', { count: spec.doctorsCount })}
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
                                    <Link key={name} to={`/doctors?specialization=${name}`} className='group'>
                                        <Card hover className='text-center transition-all group-hover:border-teal-500'>
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
                            <Button variant='outline' size='lg' rightIcon={<ArrowRight className='w-5 h-5' />}>
                                {t('landing.specializations.all_specs')}
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
                        <p className='text-xl text-slate-600'>{config.stepsSection.subtitle}</p>
                    </div>

                    <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {(config.stepsSection.steps || []).slice(0, 4).map((step, index) => (
                            <div key={index} className='relative text-center lg:text-left'>
                                <div className='text-7xl font-bold text-teal-100 mb-4'>
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <h3 className='text-xl font-semibold text-slate-900 mb-2'>{step.title}</h3>
                                <p className='text-slate-600'>{step.description}</p>
                                {index < (config.stepsSection.steps || []).slice(0, 4).length - 1 && (
                                    <ArrowRight className='hidden lg:block absolute top-8 -right-4 w-8 h-8 text-teal-300' />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Top Doctors Carousel */}
            {doctors.length > 0 && <DoctorsCarousel doctors={doctors} />}

            {/* Testimonials */}
            <section className='py-24 bg-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='text-center mb-16'>
                        <span className='inline-block px-4 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4'>
                            {t('landing.testimonials.badge')}
                        </span>
                        <h2 className='text-3xl sm:text-4xl font-bold text-slate-900 mb-4'>
                            {t('landing.testimonials.title')}
                        </h2>
                        <p className='text-xl text-slate-600'>{t('landing.testimonials.subtitle')}</p>
                    </div>

                    <div className='grid md:grid-cols-3 gap-8'>
                        {testimonials.map((testimonial, idx) => (
                            <Card key={idx} className='border-0 shadow-lg'>
                                <CardContent className='p-8'>
                                    <div className='flex items-center gap-1 mb-4'>
                                        {[...Array(testimonial.rating)].map((_, i) => (
                                            <Star key={i} className='w-5 h-5 text-amber-400 fill-amber-400' />
                                        ))}
                                    </div>
                                    <p className='text-slate-600 mb-6 italic'>"{testimonial.text}"</p>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-semibold'>
                                            {testimonial.avatar}
                                        </div>
                                        <p className='font-medium text-slate-900'>{testimonial.name}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id='about' className='py-24 bg-gradient-to-br from-teal-600 to-sky-700'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='grid lg:grid-cols-2 gap-12 items-center'>
                        <div className='text-white'>
                            <span className='inline-block px-4 py-1 bg-white/20 text-white rounded-full text-sm font-medium mb-6'>
                                {config.aboutSection.badge}
                            </span>
                            <h2 className='text-3xl sm:text-4xl font-bold mb-6'>{config.aboutSection.title}</h2>
                            <p className='text-white/80 text-lg mb-6 leading-relaxed'>{config.aboutSection.description}</p>
                            <div className='space-y-4 mb-8'>
                                {(config.aboutSection.bullets || []).map((item, idx) => (
                                    <div className='flex items-center gap-3' key={idx}>
                                        <CheckCircle className='w-6 h-6 text-teal-300 flex-shrink-0' />
                                        <span className='text-white/90'>{item}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to='/register'>
                                <Button size='lg' className='text-teal-700 hover:bg-teal-50'>
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
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[0]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[0]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Award className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[2]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[2]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Stethoscope className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[1]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[1]?.label}</p>
                                    </CardContent>
                                </Card>
                                <Card className='bg-white/10 backdrop-blur border-white/20'>
                                    <CardContent className='p-6 text-center'>
                                        <Heart className='w-12 h-12 text-white mx-auto mb-4' />
                                        <div className='text-3xl font-bold text-white mb-1'>{config.stats?.[3]?.value}</div>
                                        <p className='text-white/70'>{config.stats?.[3]?.label}</p>
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
                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-500 transition-colors'>
                                <Phone className='w-7 h-7 text-teal-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.phone.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.phone.note}</p>
                            <a
                                href={`tel:${(config.contactSection.phone.value || "").replace(/\s+/g, "").replace(/[()\\-]/g, "")}`}
                                className='text-xl font-semibold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.phone.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-500 transition-colors'>
                                <Mail className='w-7 h-7 text-sky-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.email.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.email.note}</p>
                            <a
                                href={`mailto:${config.contactSection.email.value}`}
                                className='text-xl font-semibold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-2'>
                                {config.contactSection.email.value}
                                <ExternalLink className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                            </a>
                        </div>

                        <div className='group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-teal-200'>
                            <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-violet-600 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity' />
                            <div className='w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-500 transition-colors'>
                                <MapPin className='w-7 h-7 text-violet-600 group-hover:text-white transition-colors' />
                            </div>
                            <h3 className='text-lg font-semibold text-slate-900 mb-2'>{config.contactSection.address.title}</h3>
                            <p className='text-slate-500 text-sm mb-4'>{config.contactSection.address.note}</p>
                            <p className='text-xl font-semibold text-violet-600'>{config.contactSection.address.value}</p>
                        </div>
                    </div>

                    <div className='grid lg:grid-cols-5 gap-8'>
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

                        <div className='lg:col-span-2 bg-gradient-to-br from-teal-600 to-sky-700 rounded-2xl p-8 text-white flex flex-col justify-between'>
                            <div>
                                <h3 className='text-2xl font-bold mb-4'>{config.contactSection.quickCard.title}</h3>
                                <p className='text-white/80 mb-6 leading-relaxed'>{config.contactSection.quickCard.description}</p>
                                <div className='space-y-3 mb-8'>
                                    {(config.contactSection.quickCard.bullets || []).map((item, idx) => (
                                        <div className='flex items-center gap-3' key={idx}>
                                            <CheckCircle className='w-5 h-5 text-teal-300 flex-shrink-0' />
                                            <span className='text-white/90 text-sm'>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Link to='/doctors'>
                                <Button
                                    size='lg'
                                    className='w-full text-teal-700 hover:bg-teal-50 shadow-lg'
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
                            {t('landing.cta.title')}
                        </h2>
                        <p className='text-xl text-slate-300 mb-8 max-w-2xl mx-auto'>
                            {t('landing.cta.description')}
                        </p>
                        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                            <Link to='/register'>
                                <Button size='lg' className='bg-teal-500 hover:bg-teal-600 text-white shadow-lg'>
                                    {t('landing.cta.register')}
                                </Button>
                            </Link>
                            <Link to='/doctors'>
                                <Button size='lg' className='bg-white/20 backdrop-blur border-2 border-white/50 text-white hover:bg-white/30'>
                                    {t('landing.cta.view_doctors')}
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
