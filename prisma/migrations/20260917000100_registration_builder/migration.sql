-- CreateTable
CREATE TABLE "RegistrationPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "configuration" JSONB NOT NULL,
    "styling" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "publishedSnapshot" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "WholesaleApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "registrationPageId" TEXT,
    "pageName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedData" JSONB NOT NULL,
    "configurationSnapshot" JSONB NOT NULL,
    "settingsSnapshot" JSONB NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "applicantName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT,
    "companyId" TEXT,
    "companyLocationId" TEXT,
    "companyContactId" TEXT,
    "adminNote" TEXT NOT NULL DEFAULT '',
    "integrationError" TEXT,
    "integrationState" JSONB NOT NULL DEFAULT '{}',
    "processingAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WholesaleApplication_registrationPageId_fkey" FOREIGN KEY ("registrationPageId") REFERENCES "RegistrationPage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BLOB NOT NULL,
    CONSTRAINT "ApplicationFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "WholesaleApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionNonce" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubmissionRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "EmailNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "WholesaleApplication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RegistrationPage_shop_updatedAt_idx" ON "RegistrationPage"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPage_shop_handle_key" ON "RegistrationPage"("shop", "handle");

-- CreateIndex
CREATE INDEX "WholesaleApplication_shop_status_createdAt_idx" ON "WholesaleApplication"("shop", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WholesaleApplication_shop_email_idx" ON "WholesaleApplication"("shop", "email");

-- CreateIndex
CREATE INDEX "ApplicationFile_shop_applicationId_idx" ON "ApplicationFile"("shop", "applicationId");

-- CreateIndex
CREATE INDEX "SubmissionNonce_shop_expiresAt_idx" ON "SubmissionNonce"("shop", "expiresAt");

-- CreateIndex
CREATE INDEX "SubmissionRate_shop_windowStart_idx" ON "SubmissionRate"("shop", "windowStart");

-- CreateIndex
CREATE INDEX "EmailNotification_shop_applicationId_idx" ON "EmailNotification"("shop", "applicationId");

