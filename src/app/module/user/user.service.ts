import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";

const UploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { imagePublicId: true, imageUrl: true },
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
			imagePublicId: cloudinaryResult.public_id,
		},
		omit: { password: true },
	});

	// Delete old image from Cloudinary after DB update succeeds
	if (currentUser?.imagePublicId) {
		try {
			await cloudinary.uploader.destroy(currentUser.imagePublicId);
		} catch (err) {
			console.error("Failed to delete old Cloudinary image:", err);
		}
	}

	return updatedUser;
};

const getUserProfile = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		omit: { password: true },
	});

	if (!user) {
		throw new Error("User not found");
	}

	return user;
};

const updateUserProfile = async (userId: string, payload: { name: string }) => {
	const user = await prisma.user.update({
		where: { id: userId },
		data: { name: payload.name },
		omit: { password: true },
	});

	return user;
};

export const userService = {
	UploadProfileImage,
	getUserProfile,
	updateUserProfile,
};
