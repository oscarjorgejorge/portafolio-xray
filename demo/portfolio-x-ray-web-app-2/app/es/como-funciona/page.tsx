import type { Metadata } from "next"
import { HowItWorksPage } from "@/components/seo-landing"

export const metadata: Metadata = {
  title: "Cómo funciona el Generador de X-Ray de Cartera | Portfolio X-Ray",
  description: "Guía paso a paso: añade tus activos por ISIN, define los pesos y genera tu Instant X-Ray de Morningstar gratis, sin necesidad de cuenta.",
}

export default function Page() {
  return <HowItWorksPage />
}
