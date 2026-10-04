import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const UploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { imagepublicId: true, imageUrl: true },
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
		cloudinary.uploader
			.upload_stream({ resource_type: "auto" }, (error, result) => {
				if (error) return reject(error);
				if (!result) return reject(new Error("No result returned from Cloudinary"));
				resolve(result);
			})
			.end(buffer);
	});

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagepublicId: cloudinaryResult.public_id,
		},
		omit: { password: true },
	});

	// Delete old image from Cloudinary after DB update succeeds
	if (currentUser?.imagepublicId) {
		try {
			await cloudinary.uploader.destroy(currentUser.imagepublicId);
		} catch (err) {
			console.error("Failed to delete old Cloudinary image:", err);
		}
	}

	return updatedUser;
};

export const userService = {
	UploadProfileImage,
};
