"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "nxfinance:dashboard-privacy";

interface PrivacyContextValue {
    isHidden: boolean;
    toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({ isHidden: false, toggle: () => {} });

export function PrivacyProvider({ children }: { children: ReactNode }) {
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        // Sincroniza com localStorage (sistema externo) só no mount do cliente,
        // pra não divergir do HTML renderizado no servidor (sem acesso a localStorage).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de um sistema externo (localStorage) no mount, não é cascata de estado interno
        if (localStorage.getItem(STORAGE_KEY) === "true") setIsHidden(true);
    }, []);

    const toggle = () => {
        setIsHidden(prev => {
            const next = !prev;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    };

    return <PrivacyContext.Provider value={{ isHidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export const useIsPrivacyMode = () => useContext(PrivacyContext).isHidden;

export function PrivacyToggleButton() {
    const { isHidden, toggle } = useContext(PrivacyContext);
    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggle}
            className="h-9 w-9 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl"
        >
            {isHidden ? <EyeOff className="h-[1.2rem] w-[1.2rem]" /> : <Eye className="h-[1.2rem] w-[1.2rem]" />}
            <span className="sr-only">{isHidden ? "Mostrar valores" : "Ocultar valores"}</span>
        </Button>
    );
}
