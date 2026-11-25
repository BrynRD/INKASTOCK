ALTER TABLE "User" ADD COLUMN     "supabaseAuthId" UUID;

CREATE UNIQUE INDEX "User_supabaseAuthId_key" ON "User"("supabaseAuthId");
