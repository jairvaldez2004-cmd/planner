-- CreateTable
CREATE TABLE "Catalogo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "dueno" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoCatalogo" (
    "id" TEXT NOT NULL,
    "catalogoId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "restriccion" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TEXT NOT NULL,
    "actualizadoEn" TEXT NOT NULL,

    CONSTRAINT "ProductoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoCatalogo_catalogoId_idx" ON "ProductoCatalogo"("catalogoId");
