-- CreateTable
CREATE TABLE "RelacionProyecto" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "etiqueta" TEXT,

    CONSTRAINT "RelacionProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelacionProyecto_workspaceId_idx" ON "RelacionProyecto"("workspaceId");
