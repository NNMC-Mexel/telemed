import { useState, useEffect } from "react";
import {
    User,
    Mail,
    Phone,
    Briefcase,
    GraduationCap,
    Clock,
    Star,
    Save,
    Camera,
    Loader2,
    Languages,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Avatar from "../../components/ui/Avatar";
import ImageCropModal from "../../components/ui/ImageCropModal";
import useAuthStore from "../../stores/authStore";
import api, { getMediaUrl, uploadFile } from "../../services/api";

function DoctorProfile() {
    const { user, updateProfile } = useAuthStore();
    const [doctor, setDoctor] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        shortBio: "",
        education: "",
        experience: 0,
        price: 0,
        consultationDuration: 30,
        languages: [],
    });

    useEffect(() => {
        fetchDoctorProfile();
    }, [user]);

    const fetchDoctorProfile = async () => {
        if (!user?.id) return;

        try {
            // Получаем всех врачей и ищем по userId на клиенте
            let response = await api.get(`/api/doctors?populate=*`);
            const allDoctors = response.data?.data || [];
            let doctorData = allDoctors.find(d => d.userId === user.id);
            
            // Если профиль врача не найден - создаём его автоматически
            if (!doctorData && user.userRole === 'doctor') {
                console.log("Creating doctor profile for user:", user.id);
                try {
                    const createRes = await api.post('/api/doctors', {
                        data: {
                            fullName: user.fullName || user.username || 'Врач',
                            users_permissions_user: user.id,
                            userId: user.id, // Добавляем поле для фильтрации
                            isActive: true,
                            rating: 0,
                            reviewsCount: 0,
                            price: 8000,
                            experience: 0,
                            workStartTime: '09:00',
                            workEndTime: '18:00',
                            breakStart: '12:00',
                            breakEnd: '14:00',
                            slotDuration: 30,
                            workingDays: '1,2,3,4,5',
                        }
                    });
                    doctorData = createRes.data?.data;
                    console.log("Doctor profile created:", doctorData);
                } catch (createError) {
                    console.error("Error creating doctor profile:", createError.response?.data || createError);
                }
            }

            if (doctorData) {
                setDoctor(doctorData);
                setFormData({
                    fullName: doctorData.fullName || user.fullName || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    shortBio: doctorData.bio || doctorData.shortBio || "",
                    education: doctorData.education || "",
                    experience: doctorData.experience || 0,
                    price: doctorData.price || 0,
                    consultationDuration: doctorData.consultationDuration || 30,
                    languages: doctorData.languages || ["Русский"],
                });
            } else {
                // Если профиль врача не найден, используем данные user
                setFormData({
                    fullName: user.fullName || "",
                    email: user.email || "",
                    phone: user.phone || "",
                    shortBio: "",
                    education: "",
                    experience: 0,
                    price: 8000,
                    consultationDuration: 30,
                    languages: ["Русский"],
                });
            }
        } catch (error) {
            console.error("Error fetching doctor profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage({ type: "", text: "" });

        try {
            if (doctor?.documentId) {
                // Обновляем профиль врача (Strapi v5 использует documentId)
                await api.put(`/api/doctors/${doctor.documentId}`, {
                    data: {
                        fullName: formData.fullName,
                        bio: formData.shortBio, // bio в схеме
                        education: formData.education,
                        experience: parseInt(formData.experience) || 0,
                        price: parseInt(formData.price) || 0,
                        consultationDuration: parseInt(formData.consultationDuration) || 30,
                        languages: formData.languages || [],
                    },
                });
            }

            // Обновляем данные пользователя
            await updateProfile({
                fullName: formData.fullName,
                phone: formData.phone,
            });

            setMessage({ type: "success", text: "Профиль успешно сохранён" });
        } catch (error) {
            setMessage({ type: "error", text: "Ошибка сохранения профиля" });
        } finally {
            setIsSaving(false);
        }
    };

    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState(null);

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be selected again
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = () => {
            setCropImageSrc(reader.result);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCroppedPhoto = async (croppedFile) => {
        if (!doctor?.documentId) return;
        try {
            const uploaded = await uploadFile(croppedFile);
            await api.put(`/api/doctors/${doctor.documentId}`, {
                data: { photo: uploaded.id },
            });
            fetchDoctorProfile();
        } catch (error) {
            console.error("Error uploading photo:", error);
        }
    };

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
            </div>
        );
    }

    return (
        <div className='space-y-6 animate-fadeIn'>
            <div>
                <h1 className='text-2xl font-bold text-slate-900'>
                    Профиль врача
                </h1>
                <p className='text-slate-600'>
                    Управляйте вашими профессиональными данными
                </p>
            </div>

            {message.text && (
                <div
                    className={`p-4 rounded-xl ${
                        message.type === "success"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                    }`}>
                    {message.text}
                </div>
            )}

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                {/* Photo & Stats */}
                <Card>
                    <CardContent className='text-center'>
                        <div className='relative inline-block mb-4'>
                            <Avatar
                                src={getMediaUrl(doctor?.photo)}
                                name={formData.fullName}
                                size='2xl'
                            />
                            <label className='absolute bottom-0 right-0 p-2 bg-teal-600 rounded-full cursor-pointer hover:bg-teal-700 transition-colors'>
                                <Camera className='w-4 h-4 text-white' />
                                <input
                                    type='file'
                                    className='hidden'
                                    accept='image/*'
                                    onChange={handlePhotoSelect}
                                />
                            </label>
                        </div>
                        <h2 className='text-xl font-semibold text-slate-900'>
                            {formData.fullName}
                        </h2>
                        <p className='text-teal-600'>
                            {doctor?.specialization?.name || "Врач"}
                        </p>

                        <div className='mt-6 grid grid-cols-2 gap-4 text-center'>
                            <div className='p-3 bg-slate-50 rounded-xl'>
                                <div className='flex items-center justify-center gap-1 text-amber-500 mb-1'>
                                    <Star className='w-4 h-4 fill-current' />
                                    <span className='font-bold'>
                                        {doctor?.rating || 0}
                                    </span>
                                </div>
                                <p className='text-xs text-slate-500'>
                                    Рейтинг
                                </p>
                            </div>
                            <div className='p-3 bg-slate-50 rounded-xl'>
                                <p className='font-bold text-slate-900'>
                                    {doctor?.reviewsCount || 0}
                                </p>
                                <p className='text-xs text-slate-500'>
                                    Отзывов
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Info */}
                <div className='lg:col-span-2 space-y-6'>
                    <Card>
                        <CardContent>
                            <h3 className='font-semibold text-slate-900 mb-4 flex items-center gap-2'>
                                <User className='w-5 h-5 text-teal-600' />
                                Основная информация
                            </h3>

                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        ФИО
                                    </label>
                                    <Input
                                        name='fullName'
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        placeholder='Полное имя'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        Email
                                    </label>
                                    <Input
                                        name='email'
                                        value={formData.email}
                                        disabled
                                        className='bg-slate-50'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        Телефон
                                    </label>
                                    <Input
                                        name='phone'
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder='+7 (___) ___-__-__'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        Стаж (лет)
                                    </label>
                                    <Input
                                        type='number'
                                        name='experience'
                                        value={formData.experience}
                                        onChange={handleChange}
                                        min='0'
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <h3 className='font-semibold text-slate-900 mb-4 flex items-center gap-2'>
                                <Briefcase className='w-5 h-5 text-teal-600' />
                                Профессиональная информация
                            </h3>

                            <div className='space-y-4'>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        О себе
                                    </label>
                                    <textarea
                                        name='shortBio'
                                        value={formData.shortBio}
                                        onChange={handleChange}
                                        rows={3}
                                        className='w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none'
                                        placeholder='Краткое описание вашего опыта и специализации...'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        Образование
                                    </label>
                                    <textarea
                                        name='education'
                                        value={formData.education}
                                        onChange={handleChange}
                                        rows={2}
                                        className='w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none'
                                        placeholder='Университет, год окончания, специальность...'
                                    />
                                </div>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div>
                                        <label className='block text-sm font-medium text-slate-700 mb-1'>
                                            Цена консультации (₸)
                                        </label>
                                        <Input
                                            type='number'
                                            name='price'
                                            value={formData.price}
                                            onChange={handleChange}
                                            min='0'
                                            step='500'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-sm font-medium text-slate-700 mb-1'>
                                            Длительность (мин)
                                        </label>
                                        <Input
                                            type='number'
                                            name='consultationDuration'
                                            value={
                                                formData.consultationDuration
                                            }
                                            onChange={handleChange}
                                            min='15'
                                            max='120'
                                            step='15'
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className='flex justify-end'>
                        <Button
                            onClick={handleSave}
                            isLoading={isSaving}
                            leftIcon={<Save className='w-4 h-4' />}>
                            Сохранить изменения
                        </Button>
                    </div>
                </div>
            </div>

            {/* Photo Crop Modal */}
            <ImageCropModal
                isOpen={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={cropImageSrc}
                onCropComplete={handleCroppedPhoto}
                aspect={1}
            />
        </div>
    );
}

export default DoctorProfile;
