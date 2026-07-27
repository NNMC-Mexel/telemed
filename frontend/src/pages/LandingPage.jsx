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
    ThumbsUp,
    ChevronLeft,
    Send,
    ExternalLink,
    Quote,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import Button from "../components/ui/Button";
import CountUp from "../components/ui/CountUp";
import {
    contentAPI,
    doctorsAPI,
    specializationsAPI,
    getMediaUrl,
    normalizeResponse,
} from "../services/api";
import { useReveal } from "../hooks/useReveal";
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
const advantageIcons = [Stethoscope, Shield, FileText];
const impactIcons = [Users, Stethoscope, Award, Heart];

// Each speciality carries its own hue so the directory reads as a colour-coded
// taxonomy instead of six identical teal tiles. Class strings are spelled out
// in full so Tailwind's scanner picks them up.
const specializationPalette = [
    { gradient: "from-teal-500 to-emerald-500", ring: "group-hover:border-teal-300", glow: "group-hover:shadow-teal-500/20", label: "group-hover:text-teal-700" },
    { gradient: "from-rose-500 to-red-500", ring: "group-hover:border-rose-300", glow: "group-hover:shadow-rose-500/20", label: "group-hover:text-rose-700" },
    { gradient: "from-violet-500 to-purple-500", ring: "group-hover:border-violet-300", glow: "group-hover:shadow-violet-500/20", label: "group-hover:text-violet-700" },
    { gradient: "from-sky-500 to-cyan-500", ring: "group-hover:border-sky-300", glow: "group-hover:shadow-sky-500/20", label: "group-hover:text-sky-700" },
    { gradient: "from-amber-500 to-orange-500", ring: "group-hover:border-amber-300", glow: "group-hover:shadow-amber-500/20", label: "group-hover:text-amber-700" },
    { gradient: "from-fuchsia-500 to-pink-500", ring: "group-hover:border-fuchsia-300", glow: "group-hover:shadow-fuchsia-500/20", label: "group-hover:text-fuchsia-700" },
];

const specializationMeta = {
    Терапевт: { Icon: Stethoscope, hue: 0 },
    Кардиолог: { Icon: Heart, hue: 1 },
    Невролог: { Icon: Brain, hue: 2 },
    Офтальмолог: { Icon: Eye, hue: 3 },
    Педиатр: { Icon: Baby, hue: 4 },
    Эндокринолог: { Icon: Pill, hue: 5 },
};

// Specialities coming from the CMS still get a stable hue instead of
// falling back to grey.
function getSpecializationStyle(name, index) {
    const meta = specializationMeta[name];
    const hue = meta ? meta.hue : index % specializationPalette.length;
    return { Icon: meta?.Icon || Stethoscope, ...specializationPalette[hue] };
}

// Lets `.spotlight` follow the cursor inside a card.
function trackSpotlight(event) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    target.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

// Small helper so stagger delays stay readable at the call site.
const delay = (ms) => ({ "--reveal-delay": `${ms}ms` });

/* -------------------------------------------------------------------------- */
/*  Shared section furniture                                                   */
/* -------------------------------------------------------------------------- */

function Eyebrow({ children, tone = "light", className }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em]",
                tone === "ink" ? "text-teal-300" : "text-teal-700",
                className,
            )}>
            <span
                aria-hidden='true'
                className={cn("h-px w-8", tone === "ink" ? "bg-teal-400/70" : "bg-teal-600/50")}
            />
            {children}
        </span>
    );
}

function SectionHeading({ eyebrow, title, subtitle, tone = "light", align = "center", className }) {
    const isCentered = align === "center";
    return (
        <div className={cn(isCentered ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
            {eyebrow && (
                <div data-reveal className={cn(isCentered && "flex justify-center")}>
                    <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
                </div>
            )}
            <h2
                data-reveal
                style={delay(80)}
                className={cn(
                    "mt-5 text-3xl font-semibold leading-[1.12] tracking-[-0.03em] sm:text-4xl lg:text-[2.7rem]",
                    tone === "ink" ? "text-white" : "text-slate-950",
                )}>
                {title}
            </h2>
            {subtitle && (
                <p
                    data-reveal
                    style={delay(160)}
                    className={cn(
                        "mt-4 text-lg leading-relaxed",
                        tone === "ink" ? "text-teal-50/70" : "text-slate-600",
                    )}>
                    {subtitle}
                </p>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

function ClinicalHero({ config, t, trustItems }) {
    const videoRef = useRef(null);

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
        };
    }, []);

    const allStats = config.stats || [];
    const visibleStats = allStats.length >= 4
        ? [allStats[0], allStats[2], allStats[3]].filter(Boolean)
        : allStats.slice(0, 3);

    return (
        <section
            aria-labelledby='landing-hero-title'
            className='hero-clinical relative flex min-h-svh flex-col overflow-hidden bg-slate-100'>
            <div className='absolute inset-0 overflow-hidden' aria-hidden='true'>
                <video
                    ref={videoRef}
                    className='hero-clinical__background-video h-full w-full object-cover'
                    src='/nnmc-campus-hero.mp4'
                    poster='/nnmc-campus-hero-poster.jpg'
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload='metadata'
                    tabIndex={-1}
                />
                <div className='hero-clinical__background-scrim absolute inset-0' />
            </div>

            <div className='relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-4 pb-12 pt-32 sm:px-6 sm:pb-14 sm:pt-36 lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,1.08fr)] lg:gap-16 lg:px-8 lg:pb-4 lg:pt-28'>
                <div className='max-w-2xl'>
                        <span className='hero-enter hero-enter--1 inline-flex items-center gap-2.5 rounded-full border border-teal-200/80 bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm shadow-teal-900/5'>
                            <span className='flex h-7 w-7 items-center justify-center rounded-full bg-teal-50'>
                                <Building2 className='h-4 w-4 text-teal-700' />
                            </span>
                            {config.hero.badge}
                        </span>

                        <h1
                            id='landing-hero-title'
                            className='hero-enter hero-enter--2 mt-7 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[3.8rem]'>
                            {config.hero.titlePrefix}<br />
                            <span className='text-teal-700'>
                                {config.hero.titleHighlight}
                            </span>
                        </h1>

                        <p className='hero-enter hero-enter--3 mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl'>
                            {config.hero.description}
                        </p>

                        <div className='hero-enter hero-enter--4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
                            <Link to='/doctors' className='group sm:w-auto'>
                                <Button
                                    size='xl'
                                    className='hero-clinical__primary-cta w-full rounded-2xl px-7 shadow-lg shadow-teal-700/20 sm:w-auto'>
                                    {config.hero.primaryButtonLabel}
                                    <ArrowRight className='ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1' />
                                </Button>
                            </Link>
                            <button
                                type='button'
                                onClick={() => document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" })}
                                className='inline-flex min-h-14 items-center justify-center rounded-2xl px-5 text-base font-semibold text-slate-700 transition-colors hover:bg-white hover:text-teal-800'>
                                {t('landing.hero.how_it_works')}
                                <ArrowRight className='ml-2 h-4 w-4' />
                            </button>
                        </div>

                        <div className='hero-enter hero-enter--5 mt-9 flex max-w-xl items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm shadow-slate-900/5'>
                            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50'>
                                <Shield className='h-5 w-5 text-emerald-700' />
                            </div>
                            <div>
                                <p className='font-semibold text-slate-900'>{t('landing.hero.trust_title')}</p>
                                <p className='mt-0.5 text-sm leading-relaxed text-slate-500'>{t('landing.hero.trust_description')}</p>
                            </div>
                        </div>

                        {visibleStats.length > 0 && (
                            <div className='hero-enter hero-enter--5 mt-8 grid max-w-xl grid-cols-3 border-t border-slate-200 pt-6 lg:mt-6 lg:pt-4'>
                                {visibleStats.map((item, idx) => (
                                    <div
                                        key={`${item.label}-${idx}`}
                                        className={cn("pr-4", idx > 0 && "border-l border-slate-200 pl-5")}>
                                        <div className='text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl'>
                                            <CountUp value={item.value} />
                                        </div>
                                        <div className='mt-1 text-xs leading-snug text-slate-500 sm:text-sm'>{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>

                <div className='hero-enter hero-enter--3 relative mx-auto w-full max-w-[540px] lg:mx-0 lg:justify-self-end'>
                    <div className='hero-clinical__service-card relative rounded-[2rem] border border-white bg-white p-5 shadow-2xl shadow-slate-900/15 sm:p-7 lg:p-8'>
                        <div className='flex items-center gap-3 border-b border-slate-100 pb-5'>
                            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white'>
                                <Building2 className='h-5 w-5' />
                            </div>
                            <div>
                                <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700'>NNMC</p>
                                <p className='text-sm font-semibold leading-snug text-slate-900'>{t('landing.hero.organization')}</p>
                            </div>
                        </div>

                        <div className='mt-7 flex items-start justify-between gap-4'>
                            <div>
                                <h2 className='text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl'>{config.heroCard.title}</h2>
                                <p className='mt-2 text-sm leading-relaxed text-slate-500 sm:text-base'>{config.heroCard.subtitle}</p>
                            </div>
                            <span className='hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex'>
                                <span className='h-2 w-2 rounded-full bg-emerald-500' />
                                {t('landing.hero.video_format')}
                            </span>
                        </div>

                        <div className='mt-6 space-y-3'>
                            {(config.heroCard.items || []).slice(0, 3).map((item, idx) => {
                                const AdvantageIcon = advantageIcons[idx] || advantageIcons[0];
                                return (
                                    <div key={`${item.title}-${idx}`} className='flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4'>
                                        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50'>
                                            <AdvantageIcon className='h-5 w-5 text-teal-700' />
                                        </div>
                                        <div>
                                            <p className='font-semibold text-slate-900'>{item.title}</p>
                                            <p className='mt-0.5 text-sm leading-relaxed text-slate-500'>{item.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className='hero-clinical__seal absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-teal-100 bg-white px-4 py-3 shadow-lg shadow-slate-900/10 sm:flex lg:-left-7'>
                        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-teal-50'>
                            <CheckCircle className='h-5 w-5 text-teal-700' />
                        </div>
                        <div>
                            <p className='text-sm font-semibold text-slate-900'>{t('landing.hero.verified_title')}</p>
                            <p className='text-xs text-slate-500'>{t('landing.hero.verified_description')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rides the bottom edge of the first screen rather than sitting
                below the fold, so it reads as the hero's base line. */}
            <TrustMarquee items={trustItems} label={config.aboutSection.badge} />
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Trust marquee — the dark base line of the hero                             */
/* -------------------------------------------------------------------------- */

function TrustMarquee({ items, label }) {
    if (items.length === 0) return null;

    const group = (hidden) => (
        <ul
            className='marquee-group gap-12 pr-12'
            aria-hidden={hidden || undefined}>
            {items.map((item, idx) => (
                <li key={`${item}-${idx}`} className='flex shrink-0 items-center gap-3'>
                    <ShieldCheck className='h-4 w-4 shrink-0 text-teal-400' />
                    <span className='whitespace-nowrap text-sm font-medium text-teal-50/85'>{item}</span>
                </li>
            ))}
        </ul>
    );

    return (
        <section
            aria-label={label}
            className='surface-ink-flat relative z-10 mt-auto overflow-hidden border-y border-white/10 py-5'>
            <div className='marquee-viewport'>
                {/* The list is duplicated so the -50% translate loops seamlessly;
                    the copy is hidden from assistive tech. */}
                <div className='marquee-track'>
                    {group(false)}
                    {group(true)}
                </div>
            </div>
            <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-900 to-transparent sm:w-28'
            />
            <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-900 to-transparent sm:w-28'
            />
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Features — asymmetric bento                                                */
/* -------------------------------------------------------------------------- */

// Only applied when the CMS supplies the full set of four cards; otherwise the
// grid degrades to equal columns.
const bentoSpans = [
    "lg:col-span-2 lg:row-span-2",
    "lg:col-span-2",
    "lg:col-span-1",
    "lg:col-span-1",
];

function FeatureBento({ section }) {
    const cards = (section.cards || []).slice(0, 4);
    const isBento = cards.length === 4;

    return (
        <section id='features' className='relative overflow-hidden bg-white py-24'>
            <div
                aria-hidden='true'
                className='absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-teal-50/70 via-sky-50/30 to-transparent'
            />
            <div aria-hidden='true' className='texture-grid absolute inset-x-0 top-0 h-[620px] text-teal-900' />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <SectionHeading
                    eyebrow={section.badge}
                    title={section.title}
                    subtitle={section.subtitle}
                    className='mb-14'
                />

                <div className={cn("grid gap-5", isBento ? "lg:grid-cols-4 lg:grid-rows-2" : "md:grid-cols-2 lg:grid-cols-4")}>
                    {cards.map((feature, index) => {
                        const FeatureIcon = featureIcons[index] || featureIcons[0];
                        const isLead = isBento && index === 0;

                        if (isLead) {
                            return (
                                <article
                                    key={index}
                                    data-reveal='scale'
                                    onMouseMove={trackSpotlight}
                                    className={cn(
                                        bentoSpans[index],
                                        "surface-ink spotlight spotlight--ink lift relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 text-white sm:p-10",
                                    )}>
                                    <div aria-hidden='true' className='texture-noise absolute inset-0' />
                                    {/* Fills the tall card's middle so the composition
                                        doesn't read as a gap between icon and copy. */}
                                    <FeatureIcon
                                        aria-hidden='true'
                                        className='pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 text-white/5.5'
                                        strokeWidth={0.75}
                                    />

                                    <div className='relative'>
                                        <div className='ambient-pulse relative flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-400/40 bg-teal-400/10 text-teal-300'>
                                            <FeatureIcon className='h-7 w-7' />
                                        </div>
                                    </div>

                                    <div className='relative mt-10'>
                                        <h3 className='text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl'>
                                            {feature.title}
                                        </h3>
                                        <p className='mt-4 max-w-md text-base leading-relaxed text-teal-50/70'>
                                            {feature.description}
                                        </p>
                                    </div>
                                </article>
                            );
                        }

                        const isWide = isBento && index === 1;

                        return (
                            <article
                                key={index}
                                data-reveal
                                style={delay(80 * index)}
                                onMouseMove={trackSpotlight}
                                className={cn(
                                    isBento ? bentoSpans[index] : "",
                                    "spotlight lift elevate-sm hover:elevate-lg group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 hover:border-teal-200",
                                    isWide && "sm:flex sm:items-center sm:gap-7",
                                )}>
                                <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-lg shadow-teal-500/25 transition-transform duration-500 group-hover:scale-105'>
                                    <FeatureIcon className='h-7 w-7' />
                                </div>
                                <div className={cn(!isWide && "mt-6")}>
                                    <h3 className='text-lg font-semibold tracking-[-0.01em] text-slate-950'>
                                        {feature.title}
                                    </h3>
                                    <p className='mt-2 text-[0.95rem] leading-relaxed text-slate-600'>
                                        {feature.description}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Specializations — colour-coded directory                                   */
/* -------------------------------------------------------------------------- */

function SpecializationTile({ name, label, count, index, countLabel }) {
    const { Icon, gradient, ring, glow, label: labelHover } = getSpecializationStyle(name, index);

    return (
        <Link
            to={`/doctors?specialization=${encodeURIComponent(name)}`}
            data-reveal='scale'
            style={delay(60 * index)}
            onMouseMove={trackSpotlight}
            className={cn(
                "spotlight lift elevate-sm group relative flex flex-col items-center overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 text-center transition-shadow hover:shadow-2xl",
                ring,
                glow,
            )}>
            <div
                className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-105",
                    gradient,
                )}>
                <Icon className='h-8 w-8' />
            </div>
            <h3 className={cn("mt-5 font-semibold text-slate-900 transition-colors", labelHover)}>
                {label}
            </h3>
            {count > 0 && (
                <p className='mt-1 text-sm text-slate-500'>{countLabel}</p>
            )}
            <ArrowRight
                aria-hidden='true'
                className='mt-3 h-4 w-4 -translate-y-1 text-slate-300 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100'
            />
        </Link>
    );
}

function SpecializationsSection({ isLoading, specializations, t, language }) {
    const fallback = useMemo(
        () => Object.keys(specializationMeta).map((name) => ({ id: name, name })),
        [],
    );
    const items = specializations.length > 0 ? specializations : fallback;

    return (
        <section id='specializations' className='relative overflow-hidden bg-slate-50/70 py-24'>
            <div
                aria-hidden='true'
                className='absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-teal-200/20 blur-3xl'
            />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <SectionHeading
                    eyebrow={t('landing.specializations.badge')}
                    title={t('landing.specializations.title')}
                    subtitle={t('landing.specializations.subtitle')}
                    className='mb-14'
                />

                {isLoading ? (
                    <div className='flex justify-center py-12'>
                        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
                    </div>
                ) : (
                    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6'>
                        {items.map((spec, index) => (
                            <SpecializationTile
                                key={spec.id || spec.name}
                                name={spec.name}
                                label={getSpecName(spec, language) || spec.name}
                                count={spec.doctorsCount}
                                countLabel={t('landing.specializations.doctors_count', { count: spec.doctorsCount })}
                                index={index}
                            />
                        ))}
                    </div>
                )}

                <div data-reveal className='mt-12 text-center'>
                    <Link to='/doctors'>
                        <Button variant='outline' size='lg' rightIcon={<ArrowRight className='h-5 w-5' />}>
                            {t('landing.specializations.all_specs')}
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Process — dark section with a connecting spine                             */
/* -------------------------------------------------------------------------- */

function ProcessSection({ section }) {
    const steps = (section.steps || []).slice(0, 4);
    if (steps.length === 0) return null;

    return (
        <section className='surface-ink relative overflow-hidden py-24 text-white sm:py-28'>
            <div aria-hidden='true' className='texture-noise absolute inset-0' />
            <div aria-hidden='true' className='texture-grid absolute inset-0 text-teal-100' />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <SectionHeading
                    eyebrow={section.badge}
                    title={section.title}
                    subtitle={section.subtitle}
                    tone='ink'
                    className='mb-16'
                />

                <div className='relative'>
                    {/* The rail sits behind the numbered markers and fades at both ends. */}
                    <div
                        aria-hidden='true'
                        className='process-rail absolute left-0 right-0 top-7 hidden h-px lg:block'
                    />
                    <div
                        aria-hidden='true'
                        className='process-rail--vertical absolute bottom-0 left-7 top-0 w-px lg:hidden'
                    />

                    <ol className='grid gap-10 lg:grid-cols-4 lg:gap-8'>
                        {steps.map((step, index) => (
                            <li
                                key={index}
                                data-reveal
                                style={delay(120 * index)}
                                className='relative flex gap-6 lg:block'>
                                <div className='relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-teal-400/30 bg-ink-900 text-lg font-bold tracking-tight text-teal-300 shadow-lg shadow-teal-950/50'>
                                    {String(index + 1).padStart(2, "0")}
                                </div>
                                <div className='pb-1 lg:mt-7 lg:pr-6'>
                                    <h3 className='text-xl font-semibold tracking-[-0.01em] text-white'>
                                        {step.title}
                                    </h3>
                                    <p className='mt-2 leading-relaxed text-teal-50/65'>
                                        {step.description}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Doctors carousel                                                           */
/* -------------------------------------------------------------------------- */

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
        <section className='relative overflow-hidden bg-white py-24'>
            <div
                aria-hidden='true'
                className='absolute right-0 top-24 h-[380px] w-[380px] rounded-full bg-sky-100/40 blur-3xl'
            />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <div className='mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between'>
                    <SectionHeading
                        eyebrow={t('landing.doctors.badge')}
                        title={t('landing.doctors.title')}
                        subtitle={t('landing.doctors.subtitle')}
                        align='left'
                    />
                    <div data-reveal className='flex items-center gap-3'>
                        {totalPages > 1 && (
                            <>
                                <button
                                    type='button'
                                    onClick={goPrev}
                                    aria-label={t('common.previous')}
                                    className='flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'>
                                    <ChevronLeft className='h-5 w-5' />
                                </button>
                                <button
                                    type='button'
                                    onClick={goNext}
                                    aria-label={t('common.next')}
                                    className='flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'>
                                    <ArrowRight className='h-5 w-5' />
                                </button>
                            </>
                        )}
                        <Link to='/doctors'>
                            <Button
                                variant='outline'
                                rightIcon={<ArrowRight className='h-4 w-4' />}>
                                {t('landing.doctors.all_doctors')}
                            </Button>
                        </Link>
                    </div>
                </div>

                <div
                    data-reveal
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
                                            <div className='lift elevate-sm flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white group-hover:border-teal-200 group-hover:shadow-2xl group-hover:shadow-teal-900/10'>
                                                <div className='relative'>
                                                    <div className='aspect-square overflow-hidden bg-slate-100 sm:aspect-[4/5]'>
                                                        {photoUrl ? (
                                                            <img
                                                                src={photoUrl}
                                                                alt={doctor.fullName}
                                                                className='h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105'
                                                            />
                                                        ) : (
                                                            <div
                                                                className={cn(
                                                                    "flex h-full w-full items-center justify-center text-4xl font-bold text-white",
                                                                    bgColor,
                                                                )}>
                                                                {initials}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div
                                                        aria-hidden='true'
                                                        className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/45 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100'
                                                    />
                                                    {isOnline && (
                                                        <span className='absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white shadow-lg'>
                                                            <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-white' />
                                                            {t('common.online')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className='flex flex-1 flex-col p-5'>
                                                    <div className='mb-3'>
                                                        <h3 className='line-clamp-1 text-lg font-semibold text-slate-900 transition-colors group-hover:text-teal-700'>
                                                            {doctor.fullName}
                                                        </h3>
                                                        <p className='text-sm font-medium text-teal-600'>
                                                            {specName}
                                                        </p>
                                                    </div>

                                                    <div className='mb-3 flex flex-wrap items-center gap-x-4 gap-y-1'>
                                                        <div className='flex items-center gap-1'>
                                                            <Star className='h-4 w-4 fill-amber-400 text-amber-400' />
                                                            <span className='font-semibold text-slate-900'>
                                                                {rating.toFixed(1)}
                                                            </span>
                                                            <span className='text-sm text-slate-500'>
                                                                ({reviewsCount})
                                                            </span>
                                                        </div>
                                                        <div className='flex items-center gap-1 text-sm text-slate-600'>
                                                            <Clock className='h-4 w-4' />
                                                            <span>
                                                                {experience}{" "}
                                                                {getYearWord(experience)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className='mb-3 h-6'>
                                                        {recommendPercent && (
                                                            <div className='flex items-center gap-1.5'>
                                                                <ThumbsUp className='h-4 w-4 text-emerald-500' />
                                                                <span className='text-sm font-medium text-emerald-600'>
                                                                    {recommendPercent}{t('common.recommend_pct')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className='mt-auto flex items-center justify-between border-t border-slate-100 pt-4'>
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
                    <div className='mt-8 flex items-center justify-center gap-2'>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                type='button'
                                aria-label={`${i + 1}`}
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

/* -------------------------------------------------------------------------- */
/*  Testimonials — editorial                                                   */
/* -------------------------------------------------------------------------- */

const testimonialAccents = [
    { avatar: "bg-teal-100 text-teal-700", quote: "text-teal-500/25" },
    { avatar: "bg-sky-100 text-sky-700", quote: "text-sky-500/25" },
    { avatar: "bg-amber-100 text-amber-700", quote: "text-amber-500/25" },
];

function TestimonialsSection({ testimonials, t }) {
    return (
        <section className='relative overflow-hidden bg-slate-50/70 py-24'>
            <div
                aria-hidden='true'
                className='absolute -left-24 top-1/3 h-[360px] w-[360px] rounded-full bg-teal-200/25 blur-3xl'
            />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <SectionHeading
                    eyebrow={t('landing.testimonials.badge')}
                    title={t('landing.testimonials.title')}
                    subtitle={t('landing.testimonials.subtitle')}
                    className='mb-14'
                />

                <div className='grid gap-6 md:grid-cols-3 md:pb-8'>
                    {testimonials.map((testimonial, idx) => {
                        const accent = testimonialAccents[idx % testimonialAccents.length];
                        return (
                            <figure
                                key={idx}
                                data-reveal
                                style={delay(100 * idx)}
                                onMouseMove={trackSpotlight}
                                className={cn(
                                    "spotlight lift elevate-sm flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-8 hover:border-teal-200 hover:shadow-2xl hover:shadow-teal-900/5",
                                    // Raising the middle card breaks the flat three-in-a-row grid.
                                    idx === 1 && "md:-translate-y-8",
                                )}>
                                <Quote aria-hidden='true' className={cn("h-10 w-10 shrink-0", accent.quote)} />

                                <div className='mt-4 flex items-center gap-1'>
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} className='h-4 w-4 fill-amber-400 text-amber-400' />
                                    ))}
                                </div>

                                <blockquote className='mt-4 flex-1 text-[1.05rem] leading-relaxed text-slate-700'>
                                    {testimonial.text}
                                </blockquote>

                                <figcaption className='mt-6 flex items-center gap-3 border-t border-slate-100 pt-6'>
                                    <span
                                        className={cn(
                                            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold",
                                            accent.avatar,
                                        )}>
                                        {testimonial.avatar}
                                    </span>
                                    <span className='font-semibold text-slate-900'>{testimonial.name}</span>
                                </figcaption>
                            </figure>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Impact — campus photography under ink                                      */
/* -------------------------------------------------------------------------- */

function ImpactSection({ section, stats }) {
    return (
        <section id='about' className='surface-ink relative overflow-hidden py-24 text-white sm:py-28'>
            {/* The real campus, dropped to a texture rather than a photo block. */}
            <div aria-hidden='true' className='absolute inset-0 opacity-[0.16] mix-blend-luminosity'>
                <img
                    src='/nnmc-campus-hero-poster.jpg'
                    alt=''
                    className='h-full w-full object-cover'
                    loading='lazy'
                />
            </div>
            <div
                aria-hidden='true'
                className='absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/90 to-ink-900/55'
            />
            <div aria-hidden='true' className='texture-noise absolute inset-0' />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <div className='grid items-center gap-14 lg:grid-cols-2'>
                    <div>
                        <div data-reveal='left'>
                            <Eyebrow tone='ink'>{section.badge}</Eyebrow>
                        </div>
                        <h2
                            data-reveal='left'
                            style={delay(80)}
                            className='mt-5 text-3xl font-semibold leading-[1.12] tracking-[-0.03em] sm:text-4xl lg:text-[2.7rem]'>
                            {section.title}
                        </h2>
                        <p
                            data-reveal='left'
                            style={delay(160)}
                            className='mt-5 text-lg leading-relaxed text-teal-50/70'>
                            {section.description}
                        </p>

                        <ul className='mt-8 space-y-4'>
                            {(section.bullets || []).map((item, idx) => (
                                <li
                                    key={idx}
                                    data-reveal='left'
                                    style={delay(220 + 70 * idx)}
                                    className='flex items-center gap-3'>
                                    <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-300'>
                                        <CheckCircle className='h-4 w-4' />
                                    </span>
                                    <span className='text-teal-50/90'>{item}</span>
                                </li>
                            ))}
                        </ul>

                        <div data-reveal='left' style={delay(520)} className='mt-10'>
                            <Link to='/register' className='group inline-block'>
                                <Button
                                    variant='inverse'
                                    size='lg'
                                    rightIcon={
                                        <ArrowRight className='h-5 w-5 transition-transform duration-300 group-hover:translate-x-1' />
                                    }>
                                    {section.buttonLabel}
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4 sm:gap-5'>
                        {(stats || []).slice(0, 4).map((stat, idx) => {
                            const StatIcon = impactIcons[idx] || impactIcons[0];
                            return (
                                <div
                                    key={`${stat.label}-${idx}`}
                                    data-reveal='scale'
                                    style={delay(120 * idx)}
                                    onMouseMove={trackSpotlight}
                                    className={cn(
                                        "spotlight spotlight--ink lift rounded-3xl border border-white/12 bg-white/[0.06] p-6 backdrop-blur-sm hover:border-teal-300/30 sm:p-7",
                                        // A slight vertical stagger keeps the 2×2 from reading as a table.
                                        idx % 2 === 1 && "sm:translate-y-6",
                                    )}>
                                    <StatIcon className='h-7 w-7 text-teal-300' />
                                    <div className='mt-6 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl'>
                                        <CountUp value={stat.value} />
                                    </div>
                                    <p className='mt-1.5 text-sm text-teal-50/60'>{stat.label}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Contact                                                                    */
/* -------------------------------------------------------------------------- */

const contactAccents = [
    { tile: "bg-gradient-to-br from-teal-500 to-emerald-500", value: "text-teal-700", border: "hover:border-teal-200" },
    { tile: "bg-gradient-to-br from-sky-500 to-cyan-500", value: "text-sky-700", border: "hover:border-sky-200" },
    { tile: "bg-gradient-to-br from-violet-500 to-purple-500", value: "text-violet-700", border: "hover:border-violet-200" },
];

function ContactSection({ section }) {
    const channels = [
        { ...section.phone, Icon: Phone, href: `tel:${(section.phone.value || "").replace(/[^\d+]/g, "")}` },
        { ...section.email, Icon: Mail, href: `mailto:${section.email.value}` },
        { ...section.address, Icon: MapPin, href: null },
    ];

    return (
        <section id='contact' className='relative overflow-hidden bg-white py-24'>
            <div
                aria-hidden='true'
                className='absolute inset-x-0 bottom-0 h-[420px] bg-gradient-to-t from-slate-50 to-transparent'
            />

            <div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
                <SectionHeading
                    eyebrow={section.badge}
                    title={section.title}
                    subtitle={section.subtitle}
                    className='mb-14'
                />

                <div className='mb-8 grid gap-5 lg:grid-cols-3'>
                    {channels.map((channel, idx) => {
                        const accent = contactAccents[idx % contactAccents.length];
                        const { Icon } = channel;
                        return (
                            <div
                                key={channel.title}
                                data-reveal
                                style={delay(90 * idx)}
                                onMouseMove={trackSpotlight}
                                className={cn(
                                    "spotlight lift elevate-sm group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 hover:shadow-2xl hover:shadow-teal-900/5",
                                    accent.border,
                                )}>
                                <div
                                    className={cn(
                                        "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:scale-105",
                                        accent.tile,
                                    )}>
                                    <Icon className='h-7 w-7' />
                                </div>
                                <h3 className='mt-6 text-lg font-semibold text-slate-900'>{channel.title}</h3>
                                <p className='mt-1.5 text-sm text-slate-500'>{channel.note}</p>
                                {channel.href ? (
                                    <a
                                        href={channel.href}
                                        className={cn(
                                            "mt-4 inline-flex items-center gap-2 text-lg font-semibold transition-colors",
                                            accent.value,
                                        )}>
                                        {channel.value}
                                        <ExternalLink className='h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100' />
                                    </a>
                                ) : (
                                    <p className={cn("mt-4 text-lg font-semibold", accent.value)}>
                                        {channel.value}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className='grid gap-5 lg:grid-cols-5'>
                    <div
                        data-reveal
                        className='elevate-md min-h-[340px] overflow-hidden rounded-3xl border border-slate-200 lg:col-span-3'>
                        <iframe
                            title='MedConnect Location'
                            src={section.mapEmbedUrl}
                            width='100%'
                            height='100%'
                            style={{ border: 0, minHeight: "340px" }}
                            allowFullScreen=''
                            loading='lazy'
                            referrerPolicy='no-referrer-when-downgrade'
                            className='h-full w-full'
                        />
                    </div>

                    <div
                        data-reveal
                        style={delay(120)}
                        className='surface-ink relative flex flex-col justify-between overflow-hidden rounded-3xl p-8 text-white lg:col-span-2'>
                        <div aria-hidden='true' className='texture-noise absolute inset-0' />
                        <div className='relative'>
                            <h3 className='text-2xl font-semibold tracking-[-0.02em]'>
                                {section.quickCard.title}
                            </h3>
                            <p className='mt-4 leading-relaxed text-teal-50/70'>
                                {section.quickCard.description}
                            </p>
                            <ul className='mt-7 space-y-3'>
                                {(section.quickCard.bullets || []).map((item, idx) => (
                                    <li className='flex items-center gap-3' key={idx}>
                                        <CheckCircle className='h-5 w-5 shrink-0 text-teal-300' />
                                        <span className='text-sm text-teal-50/85'>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Link to='/doctors' className='relative mt-8 block'>
                            <Button
                                variant='inverse'
                                size='lg'
                                className='w-full'
                                rightIcon={<Send className='h-5 w-5' />}>
                                {section.quickCard.buttonLabel}
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Closing CTA — full-bleed finale                                            */
/* -------------------------------------------------------------------------- */

function ClosingCTA({ t }) {
    return (
        <section className='surface-ink relative overflow-hidden py-28 sm:py-32'>
            <div aria-hidden='true' className='texture-noise absolute inset-0' />
            <div aria-hidden='true' className='texture-grid absolute inset-0 text-teal-100' />
            <div
                aria-hidden='true'
                className='absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/10 blur-3xl'
            />

            <div className='relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
                <div data-reveal='scale' className='flex justify-center'>
                    <span className='ambient-pulse relative flex h-16 w-16 items-center justify-center rounded-2xl border border-teal-400/40 bg-teal-400/10 text-teal-300'>
                        <Sparkles className='h-8 w-8' />
                    </span>
                </div>

                <h2
                    data-reveal
                    style={delay(100)}
                    className='mt-9 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl'>
                    {t('landing.cta.title')}
                </h2>

                <p
                    data-reveal
                    style={delay(180)}
                    className='mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-teal-50/70 sm:text-xl'>
                    {t('landing.cta.description')}
                </p>

                <div
                    data-reveal
                    style={delay(260)}
                    className='mt-10 flex flex-col justify-center gap-3 sm:flex-row'>
                    <Link to='/register' className='group'>
                        <Button
                            variant='inverse'
                            size='xl'
                            className='w-full rounded-2xl sm:w-auto'
                            rightIcon={
                                <ArrowRight className='h-5 w-5 transition-transform duration-300 group-hover:translate-x-1' />
                            }>
                            {t('landing.cta.register')}
                        </Button>
                    </Link>
                    <Link to='/doctors'>
                        <Button variant='inverseGhost' size='xl' className='w-full rounded-2xl sm:w-auto'>
                            {t('landing.cta.view_doctors')}
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

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

    // Credentials for the marquee are assembled from copy that already exists
    // elsewhere on the page, so the strip never asserts anything new.
    const trustItems = useMemo(() => {
        const bullets = config.aboutSection.bullets || [];
        const featureTitles = (config.featuresSection.cards || []).map((card) => card.title);
        return [...bullets, ...featureTitles].filter(Boolean);
    }, [config.aboutSection.bullets, config.featuresSection.cards]);

    useReveal([isLoading, doctors.length, specializations.length, i18n.language]);

    return (
        <div className='overflow-hidden'>
            <SEOHead
                title="Телемедицина ННМЦ — Онлайн-консультации врачей"
                description="MedConnect — платформа телемедицины ННМЦ. Запишитесь на онлайн-консультацию к кардиологу, неврологу, педиатру, терапевту и другим специалистам. Видеозвонки и чат с врачом."
                url="/"
                structuredData={seoStructuredData}
            />

            <ClinicalHero config={config} t={t} trustItems={trustItems} />

            <FeatureBento section={config.featuresSection} />

            <SpecializationsSection
                isLoading={isLoading}
                specializations={specializations}
                language={i18n.language}
                t={t}
            />

            <ProcessSection section={config.stepsSection} />

            {doctors.length > 0 && <DoctorsCarousel doctors={doctors} />}

            <TestimonialsSection testimonials={testimonials} t={t} />

            <ImpactSection section={config.aboutSection} stats={config.stats} />

            <ContactSection section={config.contactSection} />

            <ClosingCTA t={t} />
        </div>
    );
}

export default LandingPage;
