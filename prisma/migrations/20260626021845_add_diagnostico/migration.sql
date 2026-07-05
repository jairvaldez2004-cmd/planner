-- CreateTable
CREATE TABLE "ProyectoDiagnostico" (
    "proyectoId" TEXT NOT NULL,
    "diagnostico" JSONB NOT NULL,
    "blueprint" JSONB NOT NULL,
    "actualizadoEn" TEXT NOT NULL,

    CONSTRAINT "ProyectoDiagnostico_pkey" PRIMARY KEY ("proyectoId")
);
