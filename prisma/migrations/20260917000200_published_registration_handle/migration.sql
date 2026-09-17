ALTER TABLE "RegistrationPage" ADD COLUMN "publishedHandle" TEXT;
UPDATE "RegistrationPage" SET "publishedHandle" = "handle" WHERE "status" = 'published';
CREATE UNIQUE INDEX "RegistrationPage_shop_publishedHandle_key" ON "RegistrationPage"("shop", "publishedHandle");
