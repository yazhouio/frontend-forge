import { useLocation, useNavigate } from "react-router-dom";

export function usePageRuntimeRouter() {
    const location = useLocation();
    const navigate = useNavigate();

    return {
        route: {
            current: location.pathname,
        },
        navigation: {
            navigate: (to: string | number) => {
                navigate(to as any);
            },
            goBack: () => {
                navigate(-1);
            },
        },
    };
}