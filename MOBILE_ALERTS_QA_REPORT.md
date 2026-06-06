# Mobile UI QA: alerts, overlays, safe areas

**Date:** 2026-06-06
**Scope:** iOS and Android mobile UI for toast alerts, modal blocks, fixed headers, fixed footers, notification popovers, and manual overlays.
**Method:** static QA review of React components and mobile viewport constraints, using the reported iPhone Dynamic Island overlap as the primary reproduction signal.

## Executive summary

The confirmed defect was a global toast container rendered at `fixed top-4 right-4 z-[9999]` without safe-area offsets. On iPhone devices with a notch or Dynamic Island, this places alerts under the system status area and can cover or be covered by the island.

The fix introduces shared safe-area utilities and applies them to:

- global toast alerts;
- shared modal viewport/panel/footer;
- manual fixed overlays that bypassed the shared modal;
- public mobile header and drawer.

## Findings

| ID | Severity | Platform | Finding | Status |
|----|----------|----------|---------|--------|
| M-01 | High | iOS | Toast alerts overlap Dynamic Island/status bar because the container uses `top-4` only. | Fixed |
| M-02 | Medium | iOS/Android | Shared modal viewport used fixed padding and did not reserve safe top/bottom space. | Fixed |
| M-03 | Medium | iOS/Android | Modal footers could sit too close to the iOS home indicator / Android gesture area. | Fixed |
| M-04 | Medium | iOS/Android | Several manual overlays bypassed shared modal safe-area behavior. | Fixed |
| M-05 | Low-Med | iOS native | Public header/drawer did not account for `safe-area-inset-top`. | Fixed |
| M-06 | Low | Admin mobile | Some admin forms still use native `alert(...)`, which is visually inconsistent and not theme-controlled. | Backlog |

## Fixed areas

- `ToastProvider`: safe top/left/right offsets, bounded vertical height, scrollable stack, `role="alert"` for error toasts.
- `Modal`: safe viewport padding, safe max height, safe footer bottom padding.
- Patient cancellation result overlay: safe viewport and scrollable panel.
- Patient password change overlay: safe viewport and scrollable panel.
- Video consultation completion/rating overlays: safe viewport and scrollable panels.
- Public layout header/drawer: safe top padding.

## QA test matrix

| Case | Device class | Expected result |
|------|--------------|-----------------|
| Toast on iPhone with Dynamic Island | iPhone 14/15/16 Pro | Toast starts below Dynamic Island and remains dismissible. |
| Long toast message | iOS/Android narrow viewport | Text wraps inside the alert; close button stays visible. |
| Multiple toasts | iOS/Android | Stack remains inside safe viewport and scrolls if needed. |
| Booking modal with footer | iOS/Android | Header, content, and footer stay away from notch/status/home indicator areas. |
| Cancel appointment modal/result | iOS/Android | Modal is centered inside safe area and remains scrollable. |
| Video rating modal | iOS/Android landscape/portrait | Modal does not clip under status/navigation areas. |
| Public login/register header | iOS native/webview | Header content starts below notch/status area. |

## Remaining recommendations

- Replace remaining admin `alert(...)` calls with the shared toast/confirm modal system.
- Add visual regression checks for mobile safe-area classes using iPhone and Android viewport presets.
- Test on a real iPhone with Dynamic Island because Safari/WebView safe-area behavior can differ from desktop emulation.
