import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_HERO_VARIANT, resolveHeroVariant } from '../config/heroVariants'

/**
 * Which design the landing hero is currently wearing.
 *
 * It lives outside LandingPage because the public header renders above it and
 * has to invert with the backdrop. Persisting the last known value means a
 * repeat visit paints the correct variant immediately instead of flashing the
 * default while the CMS request is still in flight.
 */
const useHeroThemeStore = create(
    persist(
        (set) => ({
            variant: DEFAULT_HERO_VARIANT,
            setVariant: (value) => set({ variant: resolveHeroVariant(value) }),
        }),
        {
            name: 'hero-theme',
            storage: createJSONStorage(() => localStorage),
        },
    ),
)

export default useHeroThemeStore
