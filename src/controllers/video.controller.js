import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Video } from "../models/video.model.js"
import {ApiError} from "../utils/ApiErrors.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { uploadOnCloundinary } from "../utils/cloudinary.js"
import jwt from "jsonwebtoken";


const getAllVideos = asyncHandler(async (req, res) => {
    console.log(req.query)
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    //this controller is to fetch all the videos uploaded/ owned by the user
    //we will use aggregation pipeline here
    //the video which have owner field as the same userId will will be fetched
    //The basic functionality is to retrieve a paginated, filtered, and optionally sorted list of videos uploaded or owned by a specific user.
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video
    // we also have to get the duration of the file from the cloudinary object returned
    //also find out the owner of the file
    if(!(title || description)){
        throw new ApiError(400, "title or description is required")
    }

    const videoLocalPath = req.files?.videofile[0]?.path;
    const tumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (!videoLocalPath){
        throw new ApiError(400, "Video file not found!!")
    }

    if (!tumbnailLocalPath){
        throw new ApiError(400, "Thumbnail file not found!!")
    }

    const videofile = await uploadOnCloundinary(videoLocalPath)
    const thumbnail = await uploadOnCloundinary(tumbnailLocalPath)

    if (!videofile){
        throw new ApiError(400, "video file not uploaded on cloudinary")
    }

    if (!thumbnail){
        throw new ApiError(400, "thumbnail file not uploaded on cloudinary")
    }

    const durationOfVideo = videofile.duration;

    const token = req.cookies.refreshToken;

    const decodedToken = jwt.verify(
        token, process.env.REFRESH_TOKEN_SECRET
    )

    const owner = decodedToken._id;

    if(!owner){
        throw new ApiError(400, "Owner of the video not found")
    }

    const video = await Video.create({
        videofile: videofile.url,
        thumbnail: thumbnail.url,
        title: title.trim(),
        description: description.trim(),
        duration: durationOfVideo,
        isPublished: true,
        views: 0,
        owner: owner
    })

    const uploadedVideo = await Video.findById(video._id)

    if (!uploadedVideo){
        throw new ApiError(500, "something went wrong while uploading the video")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200, 
        uploadedVideo,
        "Video has been uploaded successfully"
    ))

})

const getVideoById = asyncHandler(async (req, res) => {

    const { videoId } = req.params
    
    //TODO: get video by id
    const video = await Video.findById(videoId)
    
    if (!video){
        throw new ApiError(400, "No video found!!")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        video,
        "Video fetched successfully"
    ))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    const { title, description } = req.body
    console.log(title)
    console.log(description)

    const tumbnailLocalPath = req.file?.path;
    console.log("thumbnail local path : ",tumbnailLocalPath)
    if (!tumbnailLocalPath){
        throw new ApiError(400, "Thumbnail local path not found")
    }

    const thumbnail = await uploadOnCloundinary(tumbnailLocalPath)

    const thumbnailURL = thumbnail.url
    console.log("new generated url : ",thumbnailURL)
    if (!title || !description) {
        throw new ApiError(400, "Missing required fields: title, description, or thumbnail");
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title,
                description: description,
                thumbnail: thumbnailURL
            }
        },
        {
            new: true
        }
    )

    if (!video){
        throw new ApiError(400, "Video not found")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        video,
        "Video details updated successfully"
    ))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    const deletedVideo = await Video.findByIdAndDelete(
        videoId
    )

    if(!deleteVideo){
        throw new ApiError(400, "Video not found")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        deleteVideo,
        "Video deleted successfully"
    ))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //console.log(videoId)

    const video = await Video.findById(videoId)
    if(!video){
        throw new ApiError(400, "Video not found")
    }

    video.ispublished = !video.ispublished
    const updatedVideo = await video.save()

    //console.log(updatedVideo)

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        updatedVideo,
        "Published status changed successfully"
    ))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
