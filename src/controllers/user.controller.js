import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiErrors.js";
import { User } from "../models/user.model.js"
import { uploadOnCloundinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async(userId) =>
{
    try{
        const user = await User.findById(userId) // this line finds user based on userId
        if(!user){
            throw new ApiError("400", "no user")
        }
        const accessToken = user.generateAccessToken()// generates access token
        const refreshToken = user.generateRefreshToken()// generates refresh token
        //console.log("refresh token : ", refreshToken)
        if(!refreshToken){
            throw new ApiError(400, "no refresh token generated")
        }
        //console.log(accessToken, refreshToken)
        user.refreshtoken = refreshToken// save the refresh token to the data base
        const savedInDB = await user.save({validateBeforeSave: false})
        return{accessToken, refreshToken}
    }catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // enter username, email, password, fullname
    // data validation(email correct format me hai ya nahi, password ka format sahi hai ya nahi, everything is not empty)
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload image to cloudinary, check for avatar
    // create user object - create entry in db
    // remove password and refreshToken field from response
    // check for user creation
    // return response
    //console.log(req.body);
    //console.log(req.files);
    const body = {...req.body};
    const {
        fullname,
        email,
        username,
        password
    } = body // destructuring the data coming from the front end
    //console.log("email : ", email);

    // this way also it can be done
    /*if (fullName === ""){
        throw new ApiError(400, "fullname is required")
    }

    if (email === ""){
        throw new ApiError(400, "email is required")
    }

    if (userName === ""){
        throw new ApiError(400, "Username is required")
    }

    if (password === ""){
        throw new ApiError(400, "Password is required")
    }*/

    if ([fullname, email, username, password].some((field) => !field ?.trim())) {
        throw new ApiError(400, "All fields are required");
    }
    // User we have imported from user.model.js which can interact with my database to send queries
    // here we want to see if a user with same username or email exists
    const existedUser = await User.findOne({
        $or: [{ username: username.trim().toLowerCase() }, { email: email.trim() }]
    });
    // if it exists we throw a 409 error with the error message
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    // using multer we can access the files using req.files
    // ? here is used for optional chaining 
    const avatarLocalPath = req.files ?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    // using uploadOncloudinary imported from cloudinary to upload the avata, cover image to cloudinary
    // await is used because uploading on database will take time
    const avatar = await uploadOnCloundinary(avatarLocalPath);
    const coverImage = await uploadOnCloundinary(coverImageLocalPath)
    // as avatar is required if it is not present 400 error is thrown
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }
    // creating user object for the database
    const user = await User.create({
        fullname: fullname.trim(),
        avatar: avatar.url,
        coverimage: coverImage?.url || "",
        email: email.trim(),
        password: password.trim(), // Hash this in production
        username: username.trim().toLowerCase(),
    });
    

    // if user is created find it by id(this id is automatially generated by monogdb)
    const createdUser = await User.findById(user._id).select(
        // we write here what we don't require
        "-password -refreshToken"
    )
    // throwing an error if user is not created in the database
    if (!createdUser) {
        throw new ApiError(500, "Soomething went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

});

//creating user login
const loginUser = asyncHandler(async (req, res) => {
    // enter username or email  and password
    // hit a query in the database to match the existing user based on username or email and password- req
    // validate the password using bcrypt
    // if user is present generate access and refrence token
    // send secure cookies
    // if it returns true generate a response

    //console.log(req.body);
    const {email, username, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "Username or email not found");
    }

    const user= await User.findOne({
        $or: [{username}, {email}]
    })
    //console.log("user in loginUser : ", user)
    if(!user){
        throw new ApiError(404,"User not registered")
    }

    // here User is an object of mongoose
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Password is not valid")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id) // from the genereate method creating the tokens
    //console.log(accessToken, refreshToken);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // designing cookies
    const options = {
        httpOnly: true,
        secure: true //due to this only the server can modify these cookies
    }

    //console.log(res.cookie("accessToken", accessToken, options))
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )
})

// creating user logout
const logoutUser = asyncHandler(async(req,res) => {
    //clear cookies
    //reset refreshToken
    // now we will access the user using req.user._id making a query to the database
    // then we can delete it accessToken when user logsout
    //console.log("user in logout user : ", req.user)

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true //due to this only the server can modify these cookies
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

// refreshing user accessToken
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    //console.log("incoming refresh token : ",incomingRefreshToken)
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        //console.log("decoded token : ", decodedToken)
    
        const user = await User.findById(decodedToken?._id)
        //console.log("user in refreshCookies: ",user)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        //console.log("User Refresh Token:", user?.refreshToken);
        if (incomingRefreshToken !== user?.refreshtoken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {

    const {oldPassword, newPassword} = req.body
    console.log("old password",oldPassword)
    console.log("new password",newPassword)
    const user = await User.findById(req.user?._id)
    console.log("user : ",user)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "Current user fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async (req,res) => { 
    const{fullname, email} = req.body //to update file data make seperate functions

    if(!fullname || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}//return the updated info
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloundinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated successfully"
        )
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloundinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverimage: coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
        )
    )
})

//writing aggregation pipelines (study this topic in detail)
const getUserchannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params

    if (!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields: {
            subscribersCount:{
                $size: "$subscribers"
            },
            channelsSubscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed:{
                $cond: {
                    if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project: {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
        }
    }
    
])
console.log("Channel : ",channel)

if (!channel?.length){
    throw new ApiError(404, "Channel does not exists")
}

return res
.status(200)
.json(
    new ApiResponse(200, channel[0], "User channel fetched successfully")
)

})

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json( new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserchannelProfile,
    getWatchHistory
};