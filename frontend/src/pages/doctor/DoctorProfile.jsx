import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import api, { getMediaUrl, uploadFile, normalizeResponse } from "../../services/api";

function DoctorProfile() {
    const { t } = useTranslation()
    const { user, updateProfile } = useAuthStore();
    const [doctor, setDoctor] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [reviewStats, setReviewStats] = useState({ rating: 0, count: 0 });

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
            const response = await api.get(
                `/api/doctors?filters[userId][$eq]=${user.id}&populate=*&pagination[limit]=1`
            );
            let doctorData = response.data?.data?.[0];
            
            if (doctorData) {
                setDoctor(doctorData);

                // Получаем отзывы и вычисляем рейтинг
                try {
                    const reviewsRes = await api.get(`/api/reviews?populate=*&pagination[limit]=1000`);
                    const { data: allReviews } = normalizeResponse(reviewsRes);
                    const doctorReviews = (allReviews || []).filter(
                        (r) => r.doctor?.id === doctorData.id
                    );
                    const count = doctorReviews.length;
                    const avg = count > 0
                        ? doctorReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / count
                        : 0;
                    setReviewStats({ rating: avg, count });
                } catch (e) {
                    console.error("Error fetching reviews:", e);
                }

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

            setMessage({ type: "success", text: t('doctor_profile.save_success') });
        } catch (error) {
            setMessage({ type: "error", text: t('doctor_profile.save_error') });
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
                    {t('doctor_profile.title')}
                </h1>
                <p className='text-slate-600'>
                    {t('doctor_profile.subtitle')}
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
                            {doctor?.specialization?.name || t('doctor_profile.doctor_label')}
                        </p>

                        <div className='mt-6 grid grid-cols-2 gap-4 text-center'>
                            <div className='p-3 bg-slate-50 rounded-xl'>
                                <div className='flex items-center justify-center gap-1 text-amber-500 mb-1'>
                                    <Star className='w-4 h-4 fill-current' />
                                    <span className='font-bold'>
                                        {reviewStats.rating.toFixed(1)}
                                    </span>
                                </div>
                                <p className='text-xs text-slate-500'>
                                    {t('doctor_profile.rating')}
                                </p>
                            </div>
                            <div className='p-3 bg-slate-50 rounded-xl'>
                                <p className='font-bold text-slate-900'>
                                    {reviewStats.count}
                                </p>
                                <p className='text-xs text-slate-500'>
                                    {t('doctor_profile.reviews')}
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
                                {t('doctor_profile.main_info')}
                            </h3>

                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        {t('doctor_profile.full_name')}
                                    </label>
                                    <Input
                                        name='fullName'
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        placeholder={t('doctor_profile.full_name_placeholder')}
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
                                        {t('doctor_profile.phone')}
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
                                        {t('doctor_profile.experience')}
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
                                {t('doctor_profile.professional_info')}
                            </h3>

                            <div className='space-y-4'>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        {t('doctor_profile.about')}
                                    </label>
                                    <textarea
                                        name='shortBio'
                                        value={formData.shortBio}
                                        onChange={handleChange}
                                        rows={3}
                                        className='w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none'
                                        placeholder={t('doctor_profile.about_placeholder')}
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-slate-700 mb-1'>
                                        {t('doctor_profile.education')}
                                    </label>
                                    <textarea
                                        name='education'
                                        value={formData.education}
                                        onChange={handleChange}
                                        rows={2}
                                        className='w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none'
                                        placeholder={t('doctor_profile.education_placeholder')}
                                    />
                                </div>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div>
                                        <label className='block text-sm font-medium text-slate-700 mb-1'>
                                            {t('doctor_profile.price')}
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
                                            {t('doctor_profile.duration')}
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
                            {t('doctor_profile.save')}
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
