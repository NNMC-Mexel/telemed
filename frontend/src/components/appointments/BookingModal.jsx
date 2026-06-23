import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
    format,
    addDays,
    isSameDay,
    isToday,
} from "date-fns";
import { ru, kk, enUS } from "date-fns/locale";
import {
    AlertCircle,
    Calendar,
    Clock,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Check,
    Video,
    MessageCircle,
    X,
    Lock,
    UploadCloud,
    FileText,
    ShieldCheck,
    CheckCircle2,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";
import { cn, formatPrice, getSpecName, getDoctorField, getDoctorPricing } from "../../utils/helpers";
import { generateSlotsFromIntervals, getDoctorWorkingIntervals } from "../../utils/schedule";
import { doctorsAPI, documentsAPI, getMediaUrl, getBookedSlots, getSignalingUrl } from "../../services/api";
import useAppointmentStore from "../../stores/appointmentStore";
import useAuthStore from "../../stores/authStore";
import useDocumentStore from "../../stores/documentStore";
import { buildPreparationPayload, DOCUMENT_STATUS } from "../../utils/appointmentPreparation";
import { useToast } from "../ui/Toast";

// Функция генерации временных слотов на основе настроек врача
const generateTimeSlots = (doctor) => {
    const slotDuration = doctor?.slotDuration || 30; // минуты
    return generateSlotsFromIntervals(getDoctorWorkingIntervals(doctor), slotDuration);
};

// Функция фильтрации прошедших слотов для сегодняшнего дня
const filterPastSlots = (slots, selectedDate) => {
    if (!isToday(selectedDate)) {
        return slots; // Если не сегодня - показываем все слоты
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;

    return slots.filter((slot) => {
        const [slotHour, slotMin] = slot.split(":").map(Number);
        const slotTotalMins = slotHour * 60 + slotMin;
        // Показываем только слоты, которые начинаются позже текущего времени
        return slotTotalMins > currentTotalMins;
    });
};

// Режим оплаты:
// - VITE_PAYMENTS_LIVE=true → реальные платежи (Halyk, карта)
// - Иначе → тестовая оплата (мгновенное подтверждение)
// Production fail-closed: production builds use live payments unless explicitly
// disabled for a controlled non-production preview.
const IS_PAYMENTS_LIVE = import.meta.env.PROD
    ? import.meta.env.VITE_PAYMENTS_LIVE !== "false"
    : import.meta.env.VITE_PAYMENTS_LIVE === "true";

const LIVE_PAYMENT_BASE = [
    { id: "kaspi", icon: "🏦", disabled: true },
    { id: "halyk", icon: "🏛️", disabled: false },
    { id: "card", icon: "💳", disabled: false },
];

const TEST_PAYMENT_BASE = [
    { id: "test", icon: "🧪", disabled: false },
];

const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const SIGNALING_URL = getSignalingUrl();

const DEFAULT_LANGUAGE_CODES = ["ru", "kk", "en"];
const LANGUAGE_LABEL_KEYS = {
    ru: "booking.lang_ru",
    kk: "booking.lang_kk",
    en: "booking.lang_en",
};

const normalizeLanguageCode = (value) => {
    if (typeof value !== "string") return null;

    const normalized = value
        .trim()
        .replace(/^booking\.lang_/i, "")
        .replace(/^lang_/i, "")
        .toLowerCase();

    const languageAliases = {
        ru: "ru",
        rus: "ru",
        russian: "ru",
        "русский": "ru",
        kk: "kk",
        kz: "kk",
        kazakh: "kk",
        "казахский": "kk",
        "қазақша": "kk",
        en: "en",
        eng: "en",
        english: "en",
    };

    const baseCode = normalized.split(/[-_]/)[0];
    return languageAliases[normalized] || languageAliases[baseCode] || null;
};

const getPreferredLanguageCode = (availableLanguageCodes, preferredLanguage) => {
    const preferredCode = normalizeLanguageCode(preferredLanguage);
    return preferredCode && availableLanguageCodes.includes(preferredCode)
        ? preferredCode
        : availableLanguageCodes[0];
};

const isMobileViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 640px)").matches;

// Load (or reload) ePay widget script — always fresh to avoid stale session state
const loadHalykScript = () =>
    new Promise((resolve, reject) => {
        // Remove previous script + state to avoid "payment expired" on re-attempts
        const prev = document.querySelector('script[src*="payment-api"]');
        if (prev) prev.remove();
        delete window.halyk;

        const isTest = import.meta.env.VITE_EPAY_TEST !== "false";
        const src = isTest
            ? "https://test-epay.epayment.kz/payform/payment-api.js"
            : "https://epay.homebank.kz/payform/payment-api.js";
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () =>
            reject(new Error("Failed to load payment module"));
        document.body.appendChild(script);
    });

function BookingModal({ isOpen, onClose, doctor }) {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'kk' ? kk : i18n.language === 'en' ? enUS : ru;
    const { user, token } = useAuthStore();
    const { createAppointment, updateAppointment, fetchTimeSlots, timeSlots } =
        useAppointmentStore();
    const {
        documents,
        fetchDocuments,
        uploadDocument,
        shareDocument,
        isUploading,
    } = useDocumentStore();
    const toast = useToast();
    const [liveDoctor, setLiveDoctor] = useState(null);
    const activeDoctor = liveDoctor || doctor;

    const paymentMethods = IS_PAYMENTS_LIVE
        ? LIVE_PAYMENT_BASE.map((m) => ({
              ...m,
              name: m.id === "kaspi" ? "Kaspi QR" : m.id === "halyk" ? "Halyk Bank" : t('booking.pm_card_name'),
              description: m.id === "kaspi" ? t('booking.pm_kaspi_desc') : m.id === "card" ? t('booking.pm_card_desc') : "",
              badge: m.id === "kaspi" ? t('booking.pm_kaspi_badge') : m.id === "halyk" ? t('booking.pm_halyk_badge') : null,
          }))
        : TEST_PAYMENT_BASE.map((m) => ({
              ...m,
              name: t('booking.pm_test_name'),
              description: t('booking.pm_test_desc'),
              badge: t('booking.pm_test_badge'),
          }));

    const [step, setStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [consultationType, setConsultationType] = useState("video");
    const availableLanguageCodes = useMemo(() => {
        const languages = activeDoctor?.languages?.filter(Boolean).length
            ? activeDoctor.languages
            : DEFAULT_LANGUAGE_CODES;
        const normalizedLanguages = languages
            .map(normalizeLanguageCode)
            .filter((code, index, list) => code && list.indexOf(code) === index);

        return normalizedLanguages.length ? normalizedLanguages : DEFAULT_LANGUAGE_CODES;
    }, [activeDoctor?.languages]);
    const [consultationLanguage, setConsultationLanguage] = useState(() =>
        getPreferredLanguageCode(availableLanguageCodes, i18n.language)
    );
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [patientDocumentsStatus, setPatientDocumentsStatus] = useState(DOCUMENT_STATUS.WILL_UPLOAD_LATER);
    const [doctorAccessGranted, setDoctorAccessGranted] = useState(true);
    const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
    const [uploadedPreparationDocs, setUploadedPreparationDocs] = useState([]);
    const [preparationError, setPreparationError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const timeSectionRef = useRef(null);
    const typeSectionRef = useRef(null);
    const paymentSectionRef = useRef(null);
    const preparationSectionRef = useRef(null);
    const confirmSectionRef = useRef(null);

    // Halyk QR flow state
    const [halykQR, setHalykQR] = useState(null); // { qrcode, homebankLink, billNumber }
    const [halykQRStatus, setHalykQRStatus] = useState("pending"); // pending | paid | paid_pending | appointment_error | refunded | rejected | expired

    // Real-time slot reservations: Map<time, expiresAt>
    const [reservedByOthers, setReservedByOthers] = useState(new Map())
    const socketRef = useRef(null)

    // Ref-mirror of selectedTime so socket handlers always see the fresh value
    // (the socket useEffect closes over the snapshot at subscribe time)
    const selectedTimeRef = useRef(null)
    useEffect(() => {
        selectedTimeRef.current = selectedTime
    }, [selectedTime])

    const refreshDoctorProfile = useCallback(async () => {
        const doctorRef = doctor?.documentId || doctor?.id
        if (!doctorRef) return null

        try {
            const response = await doctorsAPI.getOne(doctorRef)
            const freshDoctor = response.data?.data || response.data
            if (freshDoctor) {
                setLiveDoctor(freshDoctor)
                return freshDoctor
            }
        } catch (err) {
            console.error('Error refreshing doctor profile:', err)
        }
        return null
    }, [doctor?.documentId, doctor?.id])

    useEffect(() => {
        if (!isOpen) {
            setLiveDoctor(null)
            return
        }
        refreshDoctorProfile()
    }, [isOpen, refreshDoctorProfile])

    // Countdown ticks to refresh remaining time labels
    const [, setTick] = useState(0)
    useEffect(() => {
        if (reservedByOthers.size === 0) return
        const id = setInterval(() => setTick(t => t + 1), 30000)
        return () => clearInterval(id)
    }, [reservedByOthers.size])

    const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
    
    // Получаем рабочие дни врача (по умолчанию Пн-Пт)
    const getWorkingDays = () => {
        const normalizeDay = (day) => day === 0 ? 7 : day;
        if (activeDoctor?.workingDays) {
            if (typeof activeDoctor.workingDays === 'string') {
                return activeDoctor.workingDays.split(',').map(Number).filter(n => !isNaN(n)).map(normalizeDay);
            }
            return activeDoctor.workingDays.map(normalizeDay);
        }
        return [1, 2, 3, 4, 5]; // Пн-Пт по умолчанию
    };
    
    const workingDays = getWorkingDays();
    // JS getDay(): 0=Sun … 6=Sat. DB workingDays uses ISO: 1=Mon … 7=Sun.
    const isWorkingDay = (date) => {
        const jsDay = date.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return workingDays.includes(isoDay);
    };

    const doctorName = getDoctorField(activeDoctor, 'fullName', i18n.language) || activeDoctor?.fullName || activeDoctor?.name || t('booking.doctor_fallback');
    const doctorSpecialization = getSpecName(activeDoctor?.specialization, i18n.language)
        || t('booking.specialist_fallback');
    const doctorPricing = getDoctorPricing(activeDoctor);
    const doctorPrice = doctorPricing.effectivePrice;
    const getConsultationLanguageLabel = (language) => {
        const code = normalizeLanguageCode(language) || availableLanguageCodes[0] || "ru";
        return t(LANGUAGE_LABEL_KEYS[code] || LANGUAGE_LABEL_KEYS.ru);
    };
    const scrollToMobileSection = useCallback((sectionRef) => {
        if (!isMobileViewport() || !sectionRef.current) return;

        window.setTimeout(() => {
            sectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
                inline: "nearest",
            });
        }, 120);
    }, []);

    useEffect(() => {
        const code = normalizeLanguageCode(consultationLanguage);
        if (code && availableLanguageCodes.includes(code)) {
            if (code !== consultationLanguage) {
                setConsultationLanguage(code);
            }
            return;
        }

        setConsultationLanguage(getPreferredLanguageCode(availableLanguageCodes, i18n.language));
    }, [availableLanguageCodes, consultationLanguage, i18n.language]);

    const activeDoctorId = activeDoctor?.id;
    const activeDoctorRef = useRef(activeDoctor);

    useEffect(() => {
        activeDoctorRef.current = activeDoctor;
    }, [activeDoctor]);

    useEffect(() => {
        let isCurrentRequest = true;

        const loadSlots = async () => {
            if (!isOpen || !selectedDate || !activeDoctorId) return;

            setIsLoadingSlots(true);
            try {
                const freshDoctor = await refreshDoctorProfile();
                const slotDoctor = freshDoctor || activeDoctorRef.current;
                const dateStr = format(selectedDate, "yyyy-MM-dd");
                const slotDoctorId = slotDoctor?.id || activeDoctorId;

                // Загружаем слоты из базы и уже занятые времена одним циклом.
                // fetchTimeSlots раньше запускался без await, а обновление
                // liveDoctor перезапускало этот эффект по ссылке activeDoctor.
                const [, booked] = await Promise.all([
                    fetchTimeSlots(slotDoctorId, dateStr),
                    getBookedSlots(slotDoctorId, dateStr),
                ]);
                if (isCurrentRequest) {
                    setBookedSlots(booked);
                }
            } catch (err) {
                console.error("Error loading slots:", err);
                if (isCurrentRequest) {
                    setBookedSlots([]);
                }
            } finally {
                if (isCurrentRequest) {
                    setIsLoadingSlots(false);
                }
            }
        };

        loadSlots();
        return () => {
            isCurrentRequest = false;
        };
    }, [isOpen, selectedDate, activeDoctorId, fetchTimeSlots, refreshDoctorProfile]);

    useEffect(() => {
        if (!isOpen || step !== 1 || !selectedDate) return;
        scrollToMobileSection(timeSectionRef);
    }, [isOpen, scrollToMobileSection, selectedDate, step]);

    useEffect(() => {
        if (!isOpen || isComplete) return;

        const activeSection = {
            2: typeSectionRef,
            3: preparationSectionRef,
            4: paymentSectionRef,
            5: confirmSectionRef,
        }[step];

        if (activeSection) {
            scrollToMobileSection(activeSection);
        }
    }, [isComplete, isOpen, scrollToMobileSection, step]);

    useEffect(() => {
        if (!isOpen || !user?.id) return;
        fetchDocuments();
    }, [fetchDocuments, isOpen, user?.id]);

    // Socket: join slot-watch room when doctor + date are known, leave on cleanup
    useEffect(() => {
        if (!isOpen || !activeDoctor?.id || !selectedDate) return

        const dateStr = format(selectedDate, "yyyy-MM-dd")

        const socket = io(SIGNALING_URL, { transports: ["websocket"], auth: { token } })
        socketRef.current = socket

        socket.emit("join-slot-watch", { doctorId: activeDoctor.id, date: dateStr })

        // Re-fetch booked slots once the socket is actually connected — closes
        // the race where someone booked between the initial getBookedSlots()
        // call and our join-slot-watch (we would have missed slot-booked).
        socket.on("connect", async () => {
            try {
                const fresh = await getBookedSlots(activeDoctor.id, dateStr)
                setBookedSlots(fresh)
                if (selectedTimeRef.current && fresh.includes(selectedTimeRef.current)) {
                    toast.error(t('booking.slot_taken_other'))
                    setSelectedTime(null)
                    setStep(1)
                }
            } catch {
                // non-critical — initial fetch in loadSlots already ran
            }
        })

        socket.on("current-reservations", (reservations) => {
            const now = Date.now()
            const map = new Map()
            reservations.forEach(({ time, expiresAt }) => {
                if (expiresAt > now) map.set(time, expiresAt)
            })
            setReservedByOthers(map)
        })

        socket.on("slot-reserved", ({ time, expiresAt }) => {
            setReservedByOthers(prev => {
                const next = new Map(prev)
                next.set(time, expiresAt)
                return next
            })
            // If the user had this exact time selected (possible after their own
            // TTL expired and someone else grabbed it), kick them back to step 1.
            if (selectedTimeRef.current === time) {
                toast.error(t('booking.slot_taken_live'))
                setSelectedTime(null)
                setStep(1)
            }
        })

        socket.on("slot-released", ({ time }) => {
            setReservedByOthers(prev => {
                const next = new Map(prev)
                next.delete(time)
                return next
            })
        })

        // When our own reservation is rejected by the server
        socket.on("reserve-slot-result", ({ success, reason }) => {
            if (!success) {
                toast.error(reason || t('booking.slot_taken_default'))
                setSelectedTime(null)
            }
        })

        // When a slot is confirmed booked (DB record exists)
        socket.on("slot-booked", ({ time }) => {
            setBookedSlots(prev => prev.includes(time) ? prev : [...prev, time])
            setReservedByOthers(prev => {
                const next = new Map(prev)
                next.delete(time)
                return next
            })
            // If the user already selected this time and moved past step 1,
            // they won't see it disappear from the picker — reset them so they
            // can't continue to payment with a now-booked slot.
            if (selectedTimeRef.current === time) {
                toast.error(t('booking.slot_taken_booked'))
                setSelectedTime(null)
                setStep(1)
            }
        })

        socket.on("schedule-updated", async () => {
            const freshDoctor = await refreshDoctorProfile()
            if (!freshDoctor) return

            const freshBooked = await getBookedSlots(activeDoctor.id, dateStr).catch(() => [])
            setBookedSlots(freshBooked)

            const freshTimeSlots = await fetchTimeSlots(activeDoctor.id, dateStr).catch(() => [])
            const baseSlots = freshTimeSlots?.length
                ? freshTimeSlots.map((slot) => slot.startTime || slot.time)
                : generateTimeSlots(freshDoctor)
            const freshAvailableSlots = filterPastSlots(baseSlots, selectedDate)
                .filter((slot) => !freshBooked.includes(slot))

            if (selectedTimeRef.current && !freshAvailableSlots.includes(selectedTimeRef.current)) {
                toast.error(t('booking.schedule_updated'))
                setSelectedTime(null)
                setStep(1)
            }
        })

        return () => {
            socket.emit("leave-slot-watch", { doctorId: activeDoctor.id, date: dateStr })
            socket.disconnect()
            socketRef.current = null
        }
    }, [isOpen, activeDoctor?.id, selectedDate, fetchTimeSlots, refreshDoctorProfile, t, toast, token])

    // Emit reserve / release when selected time changes
    useEffect(() => {
        const socket = socketRef.current
        if (!socket || !activeDoctor?.id || !selectedDate) return
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        if (selectedTime) {
            socket.emit("reserve-slot", {
                doctorId: activeDoctor.id,
                date: dateStr,
                time: selectedTime,
                userId: user?.id,
            })
        }
        // release is handled server-side when a new reserve comes in from same socket
    }, [selectedTime, activeDoctor?.id, selectedDate, user?.id])

    const getAvailableSlots = () => {
        if (!selectedDate) return [];

        let slots = [];

        // Если есть слоты из Strapi TimeSlot коллекции - используем их
        if (timeSlots && timeSlots.length > 0) {
            slots = timeSlots.map((slot) => slot.startTime || slot.time);
        } else {
        // Иначе генерируем слоты на основе настроек врача
            slots = generateTimeSlots(activeDoctor);
        }

        // Фильтруем прошедшие слоты (для сегодня)
        slots = filterPastSlots(slots, selectedDate);
        
        // КРИТИЧНО: Фильтруем уже занятые слоты
        slots = slots.filter(slot => !bookedSlots.includes(slot));
        
        return slots;
    };

    const availableSlots = getAvailableSlots();

    const doctorShareRef = activeDoctor?.documentId || activeDoctor?.id;
    const doctorShareDocumentId = activeDoctor?.documentId;
    const preparationDocumentIds = useMemo(() => {
        const ids = new Set(selectedDocumentIds);
        uploadedPreparationDocs.forEach((doc) => {
            const ref = doc?.documentId || doc?.id;
            if (ref) ids.add(String(ref));
        });
        return Array.from(ids);
    }, [selectedDocumentIds, uploadedPreparationDocs]);
    const preparationPayload = useMemo(
        () =>
            buildPreparationPayload({
                selectedDocumentCount: preparationDocumentIds.length,
                patientDocumentsStatus,
                doctorAccessGranted,
            }),
        [doctorAccessGranted, patientDocumentsStatus, preparationDocumentIds.length]
    );

    const handleNext = async () => {
        if (step === 3) {
            await persistPreparationSharing();
        }
        if (step < 5) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    // Shared: fresh slot check (DB + socket reservation) + build dateTime
    const verifySlotAndBuildDateTime = async () => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");

        // 1. Check booked slots in Strapi DB
        const freshBooked = await getBookedSlots(activeDoctor.id, dateStr);
        setBookedSlots(freshBooked);

        if (freshBooked.includes(selectedTime)) {
            toast.error(t('booking.slot_taken_long'));
            setSelectedTime(null);
            setStep(1);
            return null;
        }

        // 2. Server-side atomic verify: checks both socket reservation + DB
        try {
            const verifyRes = await fetch(
                `${SIGNALING_URL}/api/slot/verify`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({
                        doctorId: activeDoctor.id,
                        date: dateStr,
                        time: selectedTime,
                        socketId: socketRef.current?.id,
                        slotDuration: activeDoctor.slotDuration || 30,
                    }),
                }
            );
            const verifyData = await verifyRes.json();
            if (!verifyData.available) {
                toast.error(verifyData.reason || t('booking.slot_unavailable'));
                setSelectedTime(null);
                setStep(1);
                return null;
            }
        } catch {
            toast.error(t('booking.slot_unavailable'));
            setSelectedTime(null);
            setStep(1);
            return null;
        }

        const dateTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(":");
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return dateTime;
    };

    // Broadcast confirmed booking to all open BookingModals for this doctor/date
    // so their slot pickers immediately hide the now-taken slot.
    const broadcastSlotConfirmed = () => {
        const socket = socketRef.current;
        if (!socket || !activeDoctor?.id || !selectedDate || !selectedTime) return;
        socket.emit("slot-confirmed", {
            doctorId: activeDoctor.id,
            date: format(selectedDate, "yyyy-MM-dd"),
            time: selectedTime,
        });
    };

    const togglePreparationDocument = (doc) => {
        const ref = doc?.documentId || doc?.id;
        if (!ref) return;
        const normalizedRef = String(ref);
        setSelectedDocumentIds((prev) =>
            prev.includes(normalizedRef)
                ? prev.filter((id) => id !== normalizedRef)
                : [...prev, normalizedRef]
        );
        setPatientDocumentsStatus(DOCUMENT_STATUS.UPLOADED);
    };

    const handlePreparationFileUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setPreparationError(null);
        const result = await uploadDocument(file, {
            title: file.name,
            type: "analysis",
            userId: user.id,
            sharedWithDoctors: doctorAccessGranted && doctorShareRef ? [doctorShareRef] : [],
        });

        if (!result.success) {
            setPreparationError(result.error);
            toast.error(result.error);
            return;
        }

        const ref = result.data?.documentId || result.data?.id;
        setUploadedPreparationDocs((prev) => [result.data, ...prev]);
        if (ref) {
            setSelectedDocumentIds((prev) =>
                prev.includes(String(ref)) ? prev : [String(ref), ...prev]
            );
        }
        setPatientDocumentsStatus(DOCUMENT_STATUS.UPLOADED);
    };

    const persistPreparationSharing = async () => {
        if (!doctorAccessGranted || !doctorShareDocumentId || preparationDocumentIds.length === 0) return;

        await Promise.all(
            preparationDocumentIds.map((documentId) =>
                shareDocument(documentId, [doctorShareDocumentId]).catch(() => null)
            )
        );
    };

    const finalizePreparationForAppointment = async (appointment) => {
        const appointmentId = appointment?.documentId || appointment?.id;
        await persistPreparationSharing();

        await Promise.all(
            preparationDocumentIds.map((documentId) =>
                appointmentId
                    ? documentsAPI.update(documentId, { appointment: appointmentId }).catch(() => null)
                    : Promise.resolve(null)
            )
        );

        if (appointmentId) {
            await updateAppointment(appointmentId, preparationPayload).catch(() => null);
        }
    };

    // Kaspi: create appointment immediately, show instructions in success screen
    const handleKaspiPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) return;

            const result = await createAppointment({
                patient: user.id,
                doctor: activeDoctor.id,
                dateTime: dateTime.toISOString(),
                type: consultationType,
                language: consultationLanguage,
                status: "pending",
                price: doctorPrice,
                paymentStatus: "pending",
                roomId: `room-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`,
                ...preparationPayload,
            });

            if (result.success) {
                await finalizePreparationForAppointment(result.data);
                setBookedSlots((prev) => [...prev, selectedTime]);
                broadcastSlotConfirmed();
                setIsComplete(true);
            } else {
                const msg = result.error || t('booking.err_create');
                toast.error(msg);
                setError(msg);
                if (msg.includes("забронировано") || msg.includes("занято")) {
                    setBookedSlots((prev) => [...prev, selectedTime]);
                    setSelectedTime(null);
                    setStep(1);
                }
            }
        } catch (err) {
            setError(t('booking.err_generic'));
        } finally {
            setIsProcessing(false);
        }
    };

    // ePay (Halyk/Card): redirect to ePay widget, appointment created on success page
    const handleEPayPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) {
                setIsProcessing(false);
                return;
            }

            // ePay requires numeric-only invoiceId (no letters/hyphens)
            const invoiceId = String(Date.now());
            const roomId = `room-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

            const successUrl = `${window.location.origin}/payment/success`;
            const failureUrl = `${window.location.origin}/payment/failure`;

            // Save booking data — appointment is created after ePay redirects back
            // patientId intentionally omitted — server forces patient = authenticated user
            // price is display-only — server re-validates against doctor record
            sessionStorage.setItem(
                "pendingBooking",
                JSON.stringify({
                    invoiceId,
                    roomId,
                    doctorId: activeDoctor.id,
                    doctorName,
                    dateTime: dateTime.toISOString(),
                    type: consultationType,
                    language: consultationLanguage,
                    price: doctorPrice,
                    paymentMethod,
                    preparation: {
                        ...preparationPayload,
                        documentIds: preparationDocumentIds,
                    },
                })
            );

            // Get OAuth token from our backend (keeps ClientSecret server-side)
            const tokenRes = await fetch(
                `${SIGNALING_URL}/api/payment/epay-token`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        invoiceId,
                        amount: doctorPrice,
                        doctorId: activeDoctor.id,
                        dateTime: dateTime.toISOString(),
                        roomId,
                        type: consultationType,
                        preparation: preparationPayload,
                    }),
                }
            );

            if (!tokenRes.ok) {
                const err = await tokenRes.json().catch(() => ({}));
                throw new Error(err.error || t('booking.err_init_payment'));
            }

            const { auth, terminalId } = await tokenRes.json();

            // Load ePay widget script
            await loadHalykScript();

            // Open ePay payment form — auth must be the full OAuth response object
            window.halyk.pay({
                auth,
                invoiceId,
                invoiceIdAlt: `${invoiceId}-alt`,
                amount: doctorPrice,
                currency: "KZT",
                terminal: terminalId,
                language: "RU",
                description: `Консультация у ${doctorName}`,
                accountId: String(user.id),
                name: user.fullName || user.username || "",
                email: user.email || "",
                phone: user.phone || "",
                backLink: successUrl,
                failureBackLink: failureUrl,
                postLink: `${SIGNALING_URL}/api/payment/epay-callback`,
                failurePostLink: `${SIGNALING_URL}/api/payment/epay-failure-callback`,
            });
            // ePay now controls the page — no setIsProcessing(false) needed
        } catch (err) {
            console.error("ePay error:", err);
            setError(err.message || t('booking.err_init_fallback'));
            setIsProcessing(false);
            sessionStorage.removeItem("pendingBooking");
        }
    };

    // Halyk Bank: uses official ePay QR by API for both mobile and desktop.
    // Mobile gets a "Open in Halyk" button (homebankLink deeplink).
    // Desktop shows a scannable QR code.
    // Both poll the server for payment status and create the appointment on PAID.
    const handleHalykPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) {
                setIsProcessing(false);
                return;
            }

            const roomId = `room-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

            const bookingData = {
                roomId,
                doctorId: activeDoctor.id,
                doctorName,
                patientId: user.id,
                patientName: user.fullName || user.username || "",
                patientEmail: user.email || "",
                patientPhone: user.phone || "",
                dateTime: dateTime.toISOString(),
                type: consultationType,
                language: consultationLanguage,
                price: doctorPrice,
                preparation: preparationPayload,
            };

            // Call server: get OAuth token + generate QR via ePay QR API
            const res = await fetch(
                `${SIGNALING_URL}/api/payment/create-halyk-qr`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ bookingData, userToken: token }),
                }
            );

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || t('booking.err_qr_gen'));
            }

            const { billNumber, qrcode, homebankLink } = await res.json();
            setHalykQR({ billNumber, qrcode, homebankLink });
            setHalykQRStatus("pending");

            // Start polling for payment status every 3 seconds
            let consecutivePollErrors = 0;
            let paidPendingSince = null;
            const MAX_POLL_ERRORS = 5;
            const PAID_PENDING_TIMEOUT_MS = 90 * 1000;
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch(
                        `${SIGNALING_URL}/api/payment/halyk-qr-status/${billNumber}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (!statusRes.ok) {
                        consecutivePollErrors++;
                        if (consecutivePollErrors >= MAX_POLL_ERRORS) {
                            clearInterval(pollInterval);
                            setHalykQRStatus("expired");
                        }
                        return;
                    }
                    consecutivePollErrors = 0;
                    const statusData = await statusRes.json().catch(() => ({}));

                    if (statusData.status === "PAID") {
                        clearInterval(pollInterval);
                        setHalykQRStatus("paid");
                        await finalizePreparationForAppointment({ documentId: statusData.appointmentId });
                        setBookedSlots((prev) =>
                            prev.includes(selectedTime)
                                ? prev
                                : [...prev, selectedTime]
                        );
                        broadcastSlotConfirmed();
                        // Give UI a moment then show success
                        setTimeout(() => {
                            setHalykQR(null);
                            setIsComplete(true);
                        }, 1500);
                    } else if (statusData.status === "PAID_PENDING_APPOINTMENT") {
                        paidPendingSince = paidPendingSince || Date.now();
                        setHalykQRStatus("paid_pending");
                        if (Date.now() - paidPendingSince >= PAID_PENDING_TIMEOUT_MS) {
                            clearInterval(pollInterval);
                            setHalykQRStatus("appointment_error");
                        }
                    } else if (statusData.status === "REFUNDED") {
                        // Slot was taken after payment; the patient was refunded
                        // automatically (QA BUG-05).
                        clearInterval(pollInterval);
                        setHalykQRStatus("refunded");
                    } else if (statusData.status === "REJECTED" || statusData.status === "CLOSED" || statusData.status === "RETURN") {
                        clearInterval(pollInterval);
                        setHalykQRStatus("rejected");
                    }
                    // Other statuses (NEW, SCANNED, BLOCKED) → keep polling
                } catch {
                    consecutivePollErrors++;
                    if (consecutivePollErrors >= MAX_POLL_ERRORS) {
                        clearInterval(pollInterval);
                        setHalykQRStatus("expired");
                    }
                }
            }, 3000);

            // Auto-expire after 20 minutes (ePay QR TTL)
            setTimeout(() => {
                clearInterval(pollInterval);
                setHalykQRStatus((s) =>
                    s === "pending" || s === "scanned" ? "expired" : s
                );
            }, 20 * 60 * 1000);
        } catch (err) {
            console.error("Halyk QR error:", err);
            setError(err.message || t('booking.err_qr_fallback'));
        } finally {
            setIsProcessing(false);
        }
    };

    // Test payment: instantly creates appointment without real payment
    const handleTestPayment = async () => {
        setIsProcessing(true);
        setError(null);
        try {
            const dateTime = await verifySlotAndBuildDateTime();
            if (!dateTime) return;

            const result = await createAppointment({
                patient: user.id,
                doctor: activeDoctor.id,
                dateTime: dateTime.toISOString(),
                type: consultationType,
                language: consultationLanguage,
                status: "confirmed",
                price: doctorPrice,
                paymentStatus: "paid",
                roomId: `room-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`,
                ...preparationPayload,
            });

            if (result.success) {
                await finalizePreparationForAppointment(result.data);
                setBookedSlots((prev) => [...prev, selectedTime]);
                broadcastSlotConfirmed();
                setIsComplete(true);
            } else {
                const msg = result.error || t('booking.err_create');
                toast.error(msg);
                setError(msg);
                if (msg.includes("забронировано") || msg.includes("занято")) {
                    setBookedSlots((prev) => [...prev, selectedTime]);
                    setSelectedTime(null);
                    setStep(1);
                }
            }
        } catch (err) {
            setError(t('booking.err_generic'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBook = () => {
        if (paymentMethod === "test") {
            handleTestPayment();
        } else if (paymentMethod === "kaspi") {
            handleKaspiPayment();
        } else if (paymentMethod === "halyk") {
            handleHalykPayment();
        } else {
            handleEPayPayment();
        }
    };

    const resetAndClose = () => {
        // Release slot reservation if one is active before closing
        const socket = socketRef.current;
        if (socket && selectedTime && selectedDate && activeDoctor?.id) {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            socket.emit("release-slot", {
                doctorId: activeDoctor.id,
                date: dateStr,
                time: selectedTime,
            });
        }
        setStep(1);
        setSelectedDate(null);
        setSelectedTime(null);
        setConsultationType("video");
        setConsultationLanguage(
            getPreferredLanguageCode(availableLanguageCodes, i18n.language)
        );
        setPaymentMethod(null);
        setPatientDocumentsStatus(DOCUMENT_STATUS.WILL_UPLOAD_LATER);
        setDoctorAccessGranted(true);
        setSelectedDocumentIds([]);
        setUploadedPreparationDocs([]);
        setPreparationError(null);
        setIsComplete(false);
        setError(null);
        setHalykQR(null);
        setHalykQRStatus("pending");
        onClose();
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return selectedDate && selectedTime;
            case 2:
                return consultationType;
            case 3:
                return true;
            case 4:
                return paymentMethod;
            default:
                return true;
        }
    };
    const confirmationRowClass = "p-4 flex items-start justify-between gap-4";
    const confirmationLabelClass = "text-slate-600 shrink-0";
    const confirmationValueClass = "font-medium text-slate-900 text-right wrap-break-word min-w-0";

    if (!doctor) return null;

    const footerButtons = !isComplete ? (
        <div className='flex items-center justify-between w-full'>
            <Button
                variant='ghost'
                onClick={step === 1 ? resetAndClose : handleBack}
                leftIcon={
                    step > 1 ? (
                        <ChevronLeft className='w-4 h-4' />
                    ) : undefined
                }>
                {step === 1 ? t('common.cancel') : t('booking.back')}
            </Button>

            {step < 5 ? (
                <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    rightIcon={<ChevronRight className='w-4 h-4' />}>
                    {t('booking.next')}
                </Button>
            ) : (
                <Button
                    onClick={handleBook}
                    isLoading={isProcessing}
                    leftIcon={<CreditCard className='w-4 h-4' />}>
                    {paymentMethod === "kaspi"
                        ? t('booking.book_kaspi', { price: formatPrice(doctorPrice) })
                        : paymentMethod === "halyk"
                        ? isMobileDevice()
                            ? t('booking.book_halyk_mobile', { price: formatPrice(doctorPrice) })
                            : t('booking.book_halyk_qr', { price: formatPrice(doctorPrice) })
                        : t('booking.book_pay', { price: formatPrice(doctorPrice) })}
                </Button>
            )}
        </div>
    ) : undefined

    // Halyk QR modal — official ePay QR by API
    if (halykQR) {
        const isPaid = halykQRStatus === "paid";
        const isPaidPending = halykQRStatus === "paid_pending";
        const isAppointmentError = halykQRStatus === "appointment_error";
        const isRefunded = halykQRStatus === "refunded";
        const isRejected = halykQRStatus === "rejected";
        const isExpired = halykQRStatus === "expired";
        const mobile = isMobileDevice();

        return (
            <Modal
                isOpen={isOpen}
                onClose={() => {
                    setHalykQR(null);
                    setHalykQRStatus("pending");
                }}
                title={t('booking.halyk_modal_title')}
                size="lg">
                <div className="flex flex-col items-center text-center py-4 space-y-5">
                    {isPaid ? (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_paid_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_paid_desc')}
                                </p>
                            </div>
                        </>
                    ) : isPaidPending ? (
                        <>
                            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center">
                                <Clock className="w-10 h-10 text-teal-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_paid_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_paid_pending_desc')}
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-teal-600 text-sm">
                                <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                <span>{t('booking.halyk_creating_wait')}</span>
                            </div>
                        </>
                    ) : isAppointmentError ? (
                        <>
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-10 h-10 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_appointment_error_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_appointment_error_desc')}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button variant="outline" onClick={() => { window.location.href = "/patient/appointments"; }}>
                                    {t('booking.my_appointments')}
                                </Button>
                                <Button onClick={() => { window.location.href = "mailto:support@nnmc.kz"; }}>
                                    {t('booking.halyk_contact_support')}
                                </Button>
                            </div>
                        </>
                    ) : isRefunded ? (
                        <>
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-10 h-10 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_refunded_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_refunded_desc')}
                                </p>
                            </div>
                            <Button onClick={() => { setHalykQR(null); setHalykQRStatus("pending"); setSelectedTime(null); setStep(1); }}>
                                {t('booking.halyk_pick_another')}
                            </Button>
                        </>
                    ) : isRejected ? (
                        <>
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                                <X className="w-10 h-10 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_rejected_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_rejected_desc')}
                                </p>
                            </div>
                            <Button onClick={() => { setHalykQR(null); setHalykQRStatus("pending"); }}>
                                {t('booking.halyk_retry')}
                            </Button>
                        </>
                    ) : isExpired ? (
                        <>
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">⏰</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                                    {t('booking.halyk_expired_title')}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {t('booking.halyk_expired_desc')}
                                </p>
                            </div>
                            <Button onClick={() => { setHalykQR(null); setHalykQRStatus("pending"); }}>
                                {t('booking.halyk_get_new_qr')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">🏛️</span>
                            </div>

                            {/* Mobile: show button to open Halyk app */}
                            {mobile && halykQR.homebankLink ? (
                                <div className="space-y-3 w-full max-w-xs">
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        {t('booking.halyk_pay_title_mobile')}
                                    </h3>
                                    <a
                                        href={halykQR.homebankLink}
                                        className="block w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors">
                                        {t('booking.halyk_open_app')}
                                    </a>
                                    <p className="text-xs text-slate-400">
                                        {t('booking.halyk_open_note')}
                                    </p>
                                </div>
                            ) : null}

                            {/* QR code — shown on desktop, or on mobile if no homebankLink */}
                            {(!mobile || !halykQR.homebankLink) && halykQR.qrcode && (
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                            {t('booking.halyk_scan_title')}
                                        </h3>
                                        <p className="text-slate-500 text-sm">
                                            {t('booking.halyk_scan_desc')}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200 inline-block">
                                        <QRCodeSVG
                                            value={halykQR.qrcode}
                                            size={200}
                                            bgColor="#ffffff"
                                            fgColor="#0f172a"
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Amount + polling indicator */}
                            <div className="bg-teal-50 rounded-xl px-4 py-3 text-sm text-teal-800 max-w-xs w-full">
                                <p className="font-semibold mb-1">
                                    {t('booking.halyk_amount', { price: formatPrice(doctorPrice) })}
                                </p>
                                <div className="flex items-center justify-center gap-2 text-teal-600 mt-1">
                                    <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs">{t('booking.halyk_waiting')}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setHalykQR(null);
                                    setHalykQRStatus("pending");
                                }}
                                className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
                                <X className="w-4 h-4" /> {t('booking.halyk_change_method')}
                            </button>
                        </>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={resetAndClose}
            title={isComplete ? t('booking.modal_title_complete') : t('booking.modal_title')}
            size='lg'
            footer={footerButtons}>
            {isComplete ? (
                <div className='text-center py-8'>
                    <div className='w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6'>
                        <Check className='w-10 h-10 text-emerald-600' />
                    </div>
                    <h3 className='text-xl font-semibold text-slate-900 mb-2'>
                        {t('booking.complete_title')}
                    </h3>
                    <p className='text-slate-600 mb-6'>
                        {t('booking.complete_desc', { name: doctorName })}
                        <br />
                        {selectedDate &&
                            format(selectedDate, "d MMMM yyyy", {
                                locale: dateLocale,
                            })}{" "}
                        {selectedTime}
                    </p>

                    {/* Kaspi payment instructions */}
                    {paymentMethod === "kaspi" && (
                        <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left'>
                            <p className='text-sm font-semibold text-amber-900 mb-2'>
                                {t('booking.kaspi_title')}
                            </p>
                            <p className='text-sm text-amber-800 mb-1'>
                                {t('booking.kaspi_amount', { price: formatPrice(doctorPrice) })}
                            </p>
                            <p className='text-xs text-amber-700'>
                                {t('booking.kaspi_note')}
                            </p>
                        </div>
                    )}

                    <div className='bg-slate-50 rounded-xl p-4 mb-6 text-left'>
                        <p className='text-sm text-slate-600 mb-2'>
                            {t('booking.email_note')}
                        </p>
                        <p className='text-sm text-slate-600'>
                            {t('booking.link_note')}
                        </p>
                    </div>
                    <div className='flex gap-3 justify-center'>
                        <Button variant='outline' onClick={resetAndClose}>
                            {t('common.close')}
                        </Button>
                        <Button
                            onClick={() =>
                                (window.location.href = "/patient/appointments")
                            }>
                            {t('booking.my_appointments')}
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Progress Steps */}
                    <div className='flex items-center mb-6'>
                        {[
                            { num: 1, label: t('booking.step_date') },
                            { num: 2, label: t('booking.step_type') },
                            { num: 3, label: t('booking.step_prepare') },
                            { num: 4, label: t('booking.step_payment') },
                            { num: 5, label: t('booking.step_done') },
                        ].flatMap((s, i) => {
                            const items = [
                                <div key={s.num} className='flex flex-col items-center gap-1 shrink-0'>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                        step >= s.num
                                            ? "bg-teal-600 text-white"
                                            : "bg-slate-200 text-slate-500"
                                    )}>
                                        {step > s.num ? <Check className='w-4 h-4' /> : s.num}
                                    </div>
                                    <span className={cn(
                                        "text-xs",
                                        step >= s.num ? "text-slate-700" : "text-slate-400"
                                    )}>
                                        {s.label}
                                    </span>
                                </div>
                            ];
                            if (i < 4) {
                                items.push(
                                    <div key={`line-${i}`} className={cn(
                                        "flex-1 h-0.5 mb-4 transition-colors",
                                        step > s.num ? "bg-teal-600" : "bg-slate-200"
                                    )} />
                                );
                            }
                            return items;
                        })}
                    </div>

                    {error && (
                        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm'>
                            {error}
                        </div>
                    )}

                    {/* Doctor Info */}
                    <div className='flex items-center gap-3 p-3 sm:p-4 bg-slate-50 rounded-xl mb-5 sm:mb-6 min-w-0'>
                        <Avatar
                            src={getMediaUrl(activeDoctor.photo)}
                            name={doctorName}
                            size='lg'
                            className='shrink-0'
                        />
                        <div className='min-w-0 flex-1'>
                            <h3 className='font-semibold text-sm sm:text-base text-slate-900 wrap-break-word leading-snug'>
                                {doctorName}
                            </h3>
                            <p className='text-sm text-teal-600'>
                                {doctorSpecialization}
                            </p>
                        </div>
                        <div className='text-right shrink-0'>
                            {doctorPricing.hasPromotion && (
                                <div className='mb-0.5 flex items-center justify-end gap-2'>
                                    <span className='text-xs text-slate-400 line-through'>
                                        {formatPrice(doctorPricing.originalPrice)}
                                    </span>
                                    <span className='rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700'>
                                        -{doctorPricing.discountPercent}%
                                    </span>
                                </div>
                            )}
                            <p className='font-bold text-slate-900'>
                                {formatPrice(doctorPrice)}
                            </p>
                            <p className='hidden sm:block text-xs text-slate-500'>
                                {t('booking.per_consultation')}
                            </p>
                        </div>
                    </div>

                    {/* Step 1: Date & Time */}
                    {step === 1 && (
                        <div className='space-y-6'>
                            <div>
                                <label className='block text-sm font-medium text-slate-700 mb-3'>
                                    {t('booking.select_date')}
                                </label>
                                <div className='flex gap-2 overflow-x-auto pb-2'>
                                    {dates.map((date) => {
                                        const isSelected =
                                            selectedDate &&
                                            isSameDay(date, selectedDate);
                                        const isWorking = isWorkingDay(date);
                                        const isDisabled = !isWorking;
                                        return (
                                            <button
                                                key={date.toISOString()}
                                                onClick={() => {
                                                    if (!isDisabled) {
                                                    setSelectedDate(date);
                                                    setSelectedTime(null);
                                                        setBookedSlots([]); // Сбрасываем занятые слоты при смене даты
                                                    }
                                                }}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "shrink-0 w-16 py-3 rounded-xl text-center transition-all",
                                                    isSelected
                                                        ? "bg-teal-600 text-white"
                                                        : isDisabled
                                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        : "bg-white border border-slate-200 hover:border-teal-500"
                                                )}>
                                                <div className='text-xs opacity-70'>
                                                    {format(date, "EEE", {
                                                        locale: dateLocale,
                                                    })}
                                                </div>
                                                <div className='text-lg font-semibold'>
                                                    {format(date, "d")}
                                                </div>
                                                <div className='text-xs opacity-70'>
                                                    {format(date, "MMM", {
                                                        locale: dateLocale,
                                                    })}
                                                </div>
                                                {isDisabled && (
                                                    <div className='text-[10px] text-slate-400'>
                                                        {t('booking.day_off')}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedDate && (
                                <div ref={timeSectionRef} className='scroll-mt-4'>
                                    <label className='block text-sm font-medium text-slate-700 mb-3'>
                                        {t('booking.select_time')}
                                    </label>
                                    {isLoadingSlots ? (
                                        <div className='flex items-center justify-center py-8'>
                                            <div className='w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin'></div>
                                            <span className='ml-2 text-slate-500'>{t('booking.loading_slots')}</span>
                                        </div>
                                    ) : availableSlots.length === 0 ? (
                                        <div className='text-center py-4'>
                                            <p className='text-slate-500'>
                                                {t('booking.no_slots_date')}
                                            </p>
                                            <p className='text-xs text-slate-400 mt-1'>
                                                {t('booking.try_another_day')}
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                        <div className='grid grid-cols-4 sm:grid-cols-7 gap-2'>
                                            {availableSlots.map((time) => {
                                                const isSelected = selectedTime === time;
                                                const heldExpiresAt = reservedByOthers.get(time);
                                                // Only treat as held-by-others if it's not our own selected slot
                                                const isHeld = !isSelected && !!heldExpiresAt && heldExpiresAt > Date.now();
                                                const minsLeft = isHeld ? Math.max(1, Math.ceil((heldExpiresAt - Date.now()) / 60000)) : 0;
                                                return (
                                                    <button
                                                        key={time}
                                                        onClick={() => !isHeld && setSelectedTime(time)}
                                                        disabled={isHeld}
                                                        title={isHeld ? t('booking.slot_held_title', { mins: minsLeft }) : undefined}
                                                        className={cn(
                                                            "py-2 px-1 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-0.5",
                                                            isSelected
                                                                ? "bg-teal-600 text-white"
                                                                : isHeld
                                                                ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-not-allowed"
                                                                : "bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50"
                                                        )}>
                                                        {isHeld && <Lock className="w-3 h-3 opacity-70" />}
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {[...reservedByOthers.keys()].some(k => k !== selectedTime) && (
                                            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                {t('booking.slots_held_notice')}
                                            </p>
                                        )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Consultation Type */}
                    {step === 2 && (
                        <div ref={typeSectionRef} className='space-y-4 scroll-mt-4'>
                            <label className='block text-sm font-medium text-slate-700 mb-3'>
                                {t('booking.select_type')}
                            </label>

                            <button
                                onClick={() => setConsultationType("video")}
                                className={cn(
                                    "w-full p-4 rounded-xl border-2 text-left transition-all",
                                    consultationType === "video"
                                        ? "border-teal-600 bg-teal-50"
                                        : "border-slate-200 hover:border-slate-300"
                                )}>
                                <div className='flex flex-col sm:flex-row sm:items-center gap-4 min-w-0'>
                                    <div
                                        className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                            consultationType === "video"
                                                ? "bg-teal-600 text-white"
                                                : "bg-slate-100 text-slate-600"
                                        )}>
                                        <Video className='w-6 h-6' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <h4 className='font-semibold text-slate-900'>
                                            {t('booking.video_title')}
                                        </h4>
                                        <p className='text-sm text-slate-500'>
                                            {t('booking.video_desc')}
                                        </p>
                                    </div>
                                    <Badge variant='primary' className='self-start sm:self-auto'>
                                        {t('booking.recommend')}
                                    </Badge>
                                </div>
                            </button>

                            <div className='w-full p-4 rounded-xl border-2 border-slate-200 text-left opacity-50 cursor-not-allowed select-none'>
                                <div className='flex flex-col sm:flex-row sm:items-center gap-4 min-w-0'>
                                    <div className='w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-400'>
                                        <MessageCircle className='w-6 h-6' />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <h4 className='font-semibold text-slate-400'>
                                            {t('booking.chat_title')}
                                        </h4>
                                        <p className='text-sm text-slate-400'>
                                            {t('booking.chat_desc')}
                                        </p>
                                    </div>
                                    <span className='text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto shrink-0'>
                                        {t('booking.in_development')}
                                    </span>
                                </div>
                            </div>

                            {/* Language selector */}
                            <div className='pt-2'>
                                <label className='block text-sm font-medium text-slate-700 mb-3'>
                                    {t('booking.select_language')}
                                </label>
                                <div className='flex gap-2'>
                                    {[
                                        { code: 'ru', label: t('booking.lang_ru') },
                                        { code: 'kk', label: t('booking.lang_kk') },
                                        { code: 'en', label: t('booking.lang_en') },
                                    ].filter(l => availableLanguageCodes.includes(l.code)).map(({ code, label }) => (
                                        <button
                                            key={code}
                                            onClick={() => setConsultationLanguage(code)}
                                            className={cn(
                                                'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                                                consultationLanguage === code
                                                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            )}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preparation */}
                    {step === 3 && (
                        <div ref={preparationSectionRef} className='space-y-5 scroll-mt-4'>
                            <div className='rounded-xl border border-teal-100 bg-teal-50 p-4'>
                                <div className='flex items-start gap-3'>
                                    <div className='w-10 h-10 rounded-xl bg-white text-teal-700 flex items-center justify-center shrink-0'>
                                        <FileText className='w-5 h-5' />
                                    </div>
                                    <div className='min-w-0'>
                                        <h3 className='font-semibold text-slate-900'>
                                            {t('booking.prepare_title')}
                                        </h3>
                                        <p className='text-sm text-slate-600 mt-1'>
                                            {t('booking.prepare_desc', { name: doctorName })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {preparationError && (
                                <div className='p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm'>
                                    {preparationError}
                                </div>
                            )}

                            <div className='space-y-3'>
                                <label className='block text-sm font-medium text-slate-700'>
                                    {t('booking.prepare_documents_label')}
                                </label>

                                <label className='flex items-center justify-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-teal-500 hover:bg-teal-50 cursor-pointer transition-colors'>
                                    <UploadCloud className='w-5 h-5 text-teal-600' />
                                    <span className='text-sm font-medium text-slate-700'>
                                        {isUploading ? t('booking.prepare_uploading') : t('booking.prepare_upload')}
                                    </span>
                                    <input
                                        type='file'
                                        className='hidden'
                                        accept='.pdf,image/jpeg,image/png,image/webp'
                                        disabled={isUploading}
                                        onChange={handlePreparationFileUpload}
                                    />
                                </label>

                                {documents.length > 0 && (
                                    <div className='space-y-2'>
                                        <p className='text-xs font-medium text-slate-500 uppercase'>
                                            {t('booking.prepare_existing_docs')}
                                        </p>
                                        <div className='max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100'>
                                            {documents.slice(0, 8).map((doc) => {
                                                const ref = String(doc.documentId || doc.id);
                                                const checked = selectedDocumentIds.includes(ref);
                                                return (
                                                    <button
                                                        key={ref}
                                                        type='button'
                                                        onClick={() => togglePreparationDocument(doc)}
                                                        className={cn(
                                                            'w-full p-3 flex items-center gap-3 text-left transition-colors',
                                                            checked ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                                                            checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'
                                                        )}>
                                                            {checked && <Check className='w-3 h-3' />}
                                                        </div>
                                                        <FileText className='w-4 h-4 text-slate-400 shrink-0' />
                                                        <div className='min-w-0 flex-1'>
                                                            <p className='text-sm font-medium text-slate-900 truncate'>
                                                                {doc.title || doc.file?.name || t('booking.prepare_document')}
                                                            </p>
                                                            <p className='text-xs text-slate-500'>
                                                                {doc.type || t('booking.prepare_document_type')}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className='grid sm:grid-cols-2 gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setPatientDocumentsStatus(DOCUMENT_STATUS.WILL_UPLOAD_LATER);
                                            setSelectedDocumentIds([]);
                                            setUploadedPreparationDocs([]);
                                        }}
                                        className={cn(
                                            'p-3 rounded-xl border text-left text-sm transition-colors',
                                            preparationDocumentIds.length === 0 && patientDocumentsStatus === DOCUMENT_STATUS.WILL_UPLOAD_LATER
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        )}
                                    >
                                        {t('booking.prepare_later')}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setPatientDocumentsStatus(DOCUMENT_STATUS.NO_DOCUMENTS);
                                            setSelectedDocumentIds([]);
                                            setUploadedPreparationDocs([]);
                                        }}
                                        className={cn(
                                            'p-3 rounded-xl border text-left text-sm transition-colors',
                                            patientDocumentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS
                                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        )}
                                    >
                                        {t('booking.prepare_no_documents')}
                                    </button>
                                </div>
                            </div>

                            <label className={cn(
                                'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                                doctorAccessGranted ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'
                            )}>
                                <input
                                    type='checkbox'
                                    checked={doctorAccessGranted}
                                    disabled={patientDocumentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS}
                                    onChange={(event) => setDoctorAccessGranted(event.target.checked)}
                                    className='mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500'
                                />
                                <span className='min-w-0'>
                                    <span className='flex items-center gap-2 font-medium text-slate-900'>
                                        <ShieldCheck className='w-4 h-4 text-teal-600' />
                                        {t('booking.prepare_access_title')}
                                    </span>
                                    <span className='block text-sm text-slate-600 mt-1'>
                                        {t('booking.prepare_access_desc', { name: doctorName })}
                                    </span>
                                </span>
                            </label>

                            <div className='rounded-xl bg-slate-50 p-4 space-y-2'>
                                <div className='flex items-center gap-2 text-sm'>
                                    <CheckCircle2 className={cn(
                                        'w-4 h-4',
                                        preparationPayload.preparationChecklist.documentsReady
                                            ? 'text-emerald-600'
                                            : 'text-slate-300'
                                    )} />
                                    <span className='text-slate-700'>{t('booking.prepare_check_documents')}</span>
                                </div>
                                <div className='flex items-center gap-2 text-sm'>
                                    <CheckCircle2 className={cn(
                                        'w-4 h-4',
                                        preparationPayload.preparationChecklist.doctorAccessGranted
                                            ? 'text-emerald-600'
                                            : 'text-slate-300'
                                    )} />
                                    <span className='text-slate-700'>{t('booking.prepare_check_access')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Payment */}
                    {step === 4 && (
                        <div ref={paymentSectionRef} className='space-y-4 scroll-mt-4'>
                            <label className='block text-sm font-medium text-slate-700 mb-3'>
                                {t('booking.payment_method_label')}
                            </label>

                            {paymentMethods.map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => !method.disabled && setPaymentMethod(method.id)}
                                    disabled={method.disabled}
                                    className={cn(
                                        "w-full p-4 rounded-xl border-2 text-left transition-all",
                                        method.disabled
                                            ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                                            : paymentMethod === method.id
                                            ? "border-teal-600 bg-teal-50"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    )}>
                                    <div className='flex items-center gap-4'>
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl",
                                            method.disabled
                                                ? "bg-slate-100"
                                                : paymentMethod === method.id
                                                ? "bg-teal-100"
                                                : "bg-slate-100"
                                        )}>
                                            {method.icon}
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <h4 className={cn(
                                                    "font-semibold",
                                                    method.disabled ? "text-slate-400" : "text-slate-900"
                                                )}>
                                                    {method.name}
                                                </h4>
                                                {paymentMethod === method.id && !method.disabled && (
                                                    <Check className='w-5 h-5 text-teal-600 shrink-0' />
                                                )}
                                            </div>
                                            <p className={cn(
                                                "text-sm",
                                                method.disabled ? "text-slate-400" : "text-slate-500"
                                            )}>
                                                {method.id === "halyk"
                                                    ? isMobileDevice()
                                                        ? t('booking.pm_halyk_desc_mobile')
                                                        : t('booking.pm_halyk_desc_desktop')
                                                    : method.description}
                                            </p>
                                            {method.badge && (
                                                <span className={cn(
                                                    "inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
                                                    method.disabled
                                                        ? "text-slate-400 bg-slate-200"
                                                        : "text-teal-700 bg-teal-100"
                                                )}>
                                                    {method.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}

                            {/* ePay / Halyk informer — required by Halyk Bank internet-acquiring agreement */}
                            <div className='mt-2 p-4 bg-slate-50 rounded-xl space-y-3'>
                                <p className='text-sm text-slate-600'>
                                    {t('booking.epay_security')}{' '}
                                    <a
                                        href='/terms#refund'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-teal-600 hover:underline'
                                    >
                                        {t('booking.epay_refund_link')}
                                    </a>
                                </p>
                                <div className='flex items-center gap-3 pt-2 border-t border-slate-200'>
                                    <a
                                        href='https://epay.homebank.kz/'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors'
                                    >
                                        <div className='w-8 h-8 rounded-lg bg-[#FF6B00] flex items-center justify-center shrink-0'>
                                            <span className='text-white font-bold text-[10px] leading-none'>ePay</span>
                                        </div>
                                        <span>{t('booking.epay_partner_text')}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Confirmation */}
                    {step === 5 && (
                        <div ref={confirmSectionRef} className='space-y-4 scroll-mt-4'>
                            <h3 className='font-semibold text-slate-900 mb-4'>
                                {t('booking.confirm_title')}
                            </h3>

                            <div className='bg-slate-50 rounded-xl divide-y divide-slate-200'>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>{t('booking.field_doctor')}</span>
                                    <span className={confirmationValueClass}>
                                        {doctorName}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>
                                        {t('booking.field_spec')}
                                    </span>
                                    <span className={confirmationValueClass}>
                                        {doctorSpecialization}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>{t('booking.field_date')}</span>
                                    <span className={confirmationValueClass}>
                                        {selectedDate &&
                                            format(
                                                selectedDate,
                                                "d MMMM yyyy",
                                                { locale: dateLocale }
                                        )}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>
                                        {t('booking.field_time')}
                                    </span>
                                    <span className={confirmationValueClass}>
                                        {selectedTime}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>{t('booking.field_type')}</span>
                                    <span className={confirmationValueClass}>
                                        {consultationType === "video"
                                            ? t('booking.video_title')
                                            : t('booking.chat_title')}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>{t('booking.field_language')}</span>
                                    <span className={confirmationValueClass}>
                                        {getConsultationLanguageLabel(consultationLanguage)}
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>
                                        {t('booking.field_payment')}
                                    </span>
                                    <span className={confirmationValueClass}>
                                        {
                                            paymentMethods.find(
                                                (m) => m.id === paymentMethod
                                            )?.name
                                        }
                                    </span>
                                </div>
                                <div className={confirmationRowClass}>
                                    <span className={confirmationLabelClass}>
                                        {t('booking.field_preparation')}
                                    </span>
                                    <span className={confirmationValueClass}>
                                        {preparationPayload.patientDocumentsStatus === DOCUMENT_STATUS.UPLOADED
                                            ? t('booking.prepare_status_uploaded', { count: preparationDocumentIds.length })
                                            : preparationPayload.patientDocumentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS
                                            ? t('booking.prepare_status_no_documents')
                                            : t('booking.prepare_status_later')}
                                    </span>
                                </div>
                                <div className='p-4 flex justify-between bg-teal-50'>
                                    <span className='font-semibold text-teal-700'>
                                        {t('booking.field_total')}
                                    </span>
                                    <span className='text-right'>
                                        {doctorPricing.hasPromotion && (
                                            <span className='block text-xs text-slate-400 line-through'>
                                                {formatPrice(doctorPricing.originalPrice)}
                                            </span>
                                        )}
                                        <span className='block font-bold text-teal-700'>
                                            {formatPrice(doctorPrice)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}
        </Modal>
    );
}

export default BookingModal;
