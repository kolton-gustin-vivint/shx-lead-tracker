import { SessionProvider } from "@FO-Enablement-Vivint/magistrate/next";
import { PropsWithChildren } from "react";

export default function Layout({children}: PropsWithChildren) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    )
}
