-- CreateTable
CREATE TABLE `webauthn_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `credential_id` VARCHAR(255) NOT NULL,
    `public_key` TEXT NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,
    `transports` JSON NULL,
    `device_type` VARCHAR(64) NULL,
    `backed_up` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(120) NULL,
    `last_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `webauthn_credentials_credential_id_key`(`credential_id`),
    INDEX `webauthn_credentials_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webauthn_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `challenge` VARCHAR(255) NOT NULL,
    `purpose` VARCHAR(32) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `webauthn_challenges_challenge_key`(`challenge`),
    INDEX `webauthn_challenges_employee_id_purpose_idx`(`employee_id`, `purpose`),
    INDEX `webauthn_challenges_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `webauthn_credentials`
ADD CONSTRAINT `webauthn_credentials_employee_id_fkey`
FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webauthn_challenges`
ADD CONSTRAINT `webauthn_challenges_employee_id_fkey`
FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
