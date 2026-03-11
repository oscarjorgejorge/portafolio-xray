-- CreateTable
CREATE TABLE "anonymized_user_sequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "next_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymized_user_sequence_pkey" PRIMARY KEY ("id")
);
