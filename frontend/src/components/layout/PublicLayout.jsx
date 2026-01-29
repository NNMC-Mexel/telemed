import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Menu,
    X,
    Activity,
    Phone,
    Mail,
    MapPin,
    ChevronDown,
    UserCircle,
    Stethoscope,
} from "lucide-react";
import { cn } from "../../utils/helpers";
import Button from "../ui/Button";
import useAuthStore from "../../stores/authStore";

function PublicLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuthStore();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLoginDropdown, setShowLoginDropdown] = useState(false);
    const loginDropdownRef = useRef(null);

    // Закрываем dropdown при клике вне его
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                loginDropdownRef.current &&
                !loginDropdownRef.current.contains(event.target)
            ) {
                setShowLoginDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Определяем страницы где нужен тёмный header с самого начала
    const isDarkHeaderPage = location.pathname === "/";

    // На главной странице header становится белым при скролле
    // На других страницах header всегда белый (тёмный текст)
    const showDarkHeader = isDarkHeaderPage && !isScrolled;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const getDashboardLink = () => {
        const role = user?.role?.type || user?.role || user?.userRole;
        if (role === "admin") return "/admin";
        if (role === "doctor") return "/doctor";
        return "/patient";
    };

    const isOnLanding = location.pathname === "/";

    const navLinks = [
        { href: "/", label: "Главная" },
        { href: "/doctors", label: "Врачи" },
        { href: "#specializations", label: "Специализации", isAnchor: true },
        { href: "#about", label: "О нас", isAnchor: true },
        { href: "#contact", label: "Контакты", isAnchor: true },
    ];

    const handleNavClick = (e, link) => {
        if (link.isAnchor) {
            e.preventDefault();
            if (isOnLanding) {
                const element = document.querySelector(link.href);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                }
            } else {
                navigate("/" + link.href);
            }
        }
    };

    return (
        <div className='min-h-screen flex flex-col'>
            {/* Header */}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                    isScrolled || !isDarkHeaderPage
                        ? "bg-white/95 backdrop-blur-md shadow-sm"
                        : "bg-transparent",
                )}>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='flex items-center justify-between h-20'>
                        {/* Logo */}
                        <Link to='/' className='flex items-center gap-3'>
                            <div className='w-10 h-10 bg-gradient-to-br from-teal-500 to-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30'>
                                <Activity className='w-6 h-6 text-white' />
                            </div>
                            <div>
                                <h1
                                    className={cn(
                                        "font-bold text-lg transition-colors",
                                        showDarkHeader
                                            ? "text-white"
                                            : "text-slate-900",
                                    )}>
                                    MedConnect
                                </h1>
                                <p
                                    className={cn(
                                        "text-xs transition-colors",
                                        showDarkHeader
                                            ? "text-white/70"
                                            : "text-slate-500",
                                    )}>
                                    Телемедицина
                                </p>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className='hidden lg:flex items-center gap-8'>
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    to={link.isAnchor ? "#" : link.href}
                                    onClick={(e) => handleNavClick(e, link)}
                                    className={cn(
                                        "text-sm font-medium transition-colors hover:text-teal-500",
                                        showDarkHeader
                                            ? "text-white/90"
                                            : "text-slate-700",
                                        location.pathname === link.href &&
                                            !link.isAnchor &&
                                            "text-teal-500",
                                    )}>
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* Auth Buttons */}
                        <div className='hidden lg:flex items-center gap-4'>
                            {isAuthenticated ? (
                                <Link to={getDashboardLink()}>
                                    <Button>Личный кабинет</Button>
                                </Link>
                            ) : (
                                <>
                                    {/* Login Dropdown */}
                                    <div
                                        className='relative'
                                        ref={loginDropdownRef}>
                                        <Button
                                            variant={
                                                showDarkHeader
                                                    ? "outline"
                                                    : "ghost"
                                            }
                                            className={
                                                showDarkHeader
                                                    ? "text-white border-white/30 hover:bg-white/10"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setShowLoginDropdown(
                                                    !showLoginDropdown,
                                                )
                                            }
                                            rightIcon={
                                                <ChevronDown
                                                    className={cn(
                                                        "w-4 h-4 transition-transform",
                                                        showLoginDropdown &&
                                                            "rotate-180",
                                                    )}
                                                />
                                            }>
                                            Войти
                                        </Button>

                                        {showLoginDropdown && (
                                            <div className='absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-slideDown'>
                                                <Link
                                                    to='/login?type=patient'
                                                    className='flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors'
                                                    onClick={() =>
                                                        setShowLoginDropdown(
                                                            false,
                                                        )
                                                    }>
                                                    <div className='w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center'>
                                                        <UserCircle className='w-5 h-5 text-teal-600' />
                                                    </div>
                                                    <div>
                                                        <p className='font-medium text-slate-900'>
                                                            Пациент
                                                        </p>
                                                        <p className='text-xs text-slate-500'>
                                                            Личный кабинет
                                                            пациента
                                                        </p>
                                                    </div>
                                                </Link>
                                                <Link
                                                    to='/login?type=doctor'
                                                    className='flex items-center gap-3 px-4 py-3 hover:bg-sky-50 transition-colors border-t border-slate-100'
                                                    onClick={() =>
                                                        setShowLoginDropdown(
                                                            false,
                                                        )
                                                    }>
                                                    <div className='w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center'>
                                                        <Stethoscope className='w-5 h-5 text-sky-600' />
                                                    </div>
                                                    <div>
                                                        <p className='font-medium text-slate-900'>
                                                            Врач
                                                        </p>
                                                        <p className='text-xs text-slate-500'>
                                                            Личный кабинет врача
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                    <Link to='/register'>
                                        <Button>Регистрация</Button>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() =>
                                setIsMobileMenuOpen(!isMobileMenuOpen)
                            }
                            className={cn(
                                "lg:hidden p-2 rounded-lg transition-colors",
                                showDarkHeader
                                    ? "text-white hover:bg-white/10"
                                    : "text-slate-700 hover:bg-slate-100",
                            )}>
                            {isMobileMenuOpen ? (
                                <X className='w-6 h-6' />
                            ) : (
                                <Menu className='w-6 h-6' />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <div
                    className={cn(
                        "lg:hidden bg-white border-t border-slate-100 transition-all duration-300 overflow-hidden",
                        isMobileMenuOpen
                            ? "max-h-96 opacity-100"
                            : "max-h-0 opacity-0",
                    )}>
                    <nav className='flex flex-col p-4 gap-2'>
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                to={link.isAnchor ? "#" : link.href}
                                onClick={(e) => handleNavClick(e, link)}
                                className={cn(
                                    "px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                                    location.pathname === link.href &&
                                        !link.isAnchor
                                        ? "bg-teal-50 text-teal-700"
                                        : "text-slate-700 hover:bg-slate-50",
                                )}>
                                {link.label}
                            </Link>
                        ))}
                        <div className='pt-4 mt-2 border-t border-slate-100 flex flex-col gap-2'>
                            {isAuthenticated ? (
                                <Link to={getDashboardLink()}>
                                    <Button className='w-full'>
                                        Личный кабинет
                                    </Button>
                                </Link>
                            ) : (
                                <>
                                    <p className='text-xs text-slate-500 mb-2 px-1'>
                                        Вход в личный кабинет
                                    </p>
                                    <Link to='/login?type=patient'>
                                        <Button
                                            variant='secondary'
                                            className='w-full justify-start'
                                            leftIcon={
                                                <UserCircle className='w-4 h-4' />
                                            }>
                                            Войти как пациент
                                        </Button>
                                    </Link>
                                    <Link to='/login?type=doctor'>
                                        <Button
                                            variant='secondary'
                                            className='w-full justify-start'
                                            leftIcon={
                                                <Stethoscope className='w-4 h-4' />
                                            }>
                                            Войти как врач
                                        </Button>
                                    </Link>
                                    <Link to='/register' className='mt-2'>
                                        <Button className='w-full'>
                                            Регистрация
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className='flex-1'>
                <Outlet />
            </main>

            {/* Footer */}
            <footer id='contact' className='bg-slate-900 text-white'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12'>
                        {/* Brand */}
                        <div>
                            <div className='flex items-center gap-3 mb-6'>
                                <div className='w-10 h-10 bg-gradient-to-br from-teal-500 to-sky-500 rounded-xl flex items-center justify-center'>
                                    <Activity className='w-6 h-6 text-white' />
                                </div>
                                <div>
                                    <h3 className='font-bold text-lg'>
                                        MedConnect
                                    </h3>
                                    <p className='text-xs text-slate-400'>
                                        Телемедицина
                                    </p>
                                </div>
                            </div>
                            <p className='text-slate-400 text-sm leading-relaxed'>
                                Современная платформа телемедицины для
                                онлайн-консультаций с квалифицированными
                                врачами.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className='font-semibold mb-6'>Навигация</h4>
                            <ul className='space-y-3'>
                                <li>
                                    <Link
                                        to='/'
                                        className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        Главная
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to='/doctors'
                                        className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        Врачи
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to='/register'
                                        className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        Регистрация
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to='/login'
                                        className='text-slate-400 hover:text-white transition-colors text-sm'>
                                        Войти
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Services */}
                        <div>
                            <h4 className='font-semibold mb-6'>Услуги</h4>
                            <ul className='space-y-3 text-sm text-slate-400'>
                                <li>Онлайн-консультации</li>
                                <li>Видеозвонки с врачами</li>
                                <li>Электронные рецепты</li>
                                <li>Медицинские документы</li>
                                <li>Второе мнение</li>
                            </ul>
                        </div>

                        {/* Contact */}
                        <div>
                            <h4 className='font-semibold mb-6'>Контакты</h4>
                            <ul className='space-y-4'>
                                <li className='flex items-center gap-3 text-slate-400'>
                                    <Phone className='w-5 h-5 text-teal-500' />
                                    <span className='text-sm'>
                                        +7 (7172) 123-456
                                    </span>
                                </li>
                                <li className='flex items-center gap-3 text-slate-400'>
                                    <Mail className='w-5 h-5 text-teal-500' />
                                    <span className='text-sm'>
                                        info@medconnect.kz
                                    </span>
                                </li>
                                <li className='flex items-start gap-3 text-slate-400'>
                                    <MapPin className='w-5 h-5 text-teal-500 flex-shrink-0' />
                                    <span className='text-sm'>
                                        г. Астана, просп. Абылай хана, 42
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className='mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4'>
                        <p className='text-slate-500 text-sm'>
                            © 2025 MedConnect. Все права защищены.
                        </p>
                        <div className='flex items-center gap-6'>
                            <Link
                                to='/privacy'
                                className='text-slate-500 hover:text-white text-sm transition-colors'>
                                Политика конфиденциальности
                            </Link>
                            <Link
                                to='/terms'
                                className='text-slate-500 hover:text-white text-sm transition-colors'>
                                Условия использования
                            </Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default PublicLayout;
