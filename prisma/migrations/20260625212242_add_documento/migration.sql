-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "tipoPlano" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contenido" JSONB NOT NULL,
    "markup" TEXT NOT NULL,
    "pendientes" INTEGER NOT NULL DEFAULT 0,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TEXT NOT NULL,
    "actualizadoEn" TEXT NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionDocumento" (
    "documentoId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "markup" TEXT NOT NULL,
    "pendientes" INTEGER NOT NULL,
    "publicado" BOOLEAN NOT NULL,
    "timestamp" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,

    CONSTRAINT "VersionDocumento_pkey" PRIMARY KEY ("documentoId","version")
);
