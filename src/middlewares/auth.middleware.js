import { ApiError } from "../utils/ApiErrors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // this line checks if there is a token or a header named "Authorization"
        //console.log(req.cookies)
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        //console.log("received token : ", token);
    
        if(!token){// if there is no token throw an error
            throw new ApiError(401, "Unauthorized request")
        }
        //console.log("Secret : ",process.env.REFRESH_TOKEN_SECRET);
        
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)// using jwt we decrypt the jwt token using the securitykey
        //console.log("Decoded token : ",decodedToken);
        const user = await User.findById(decodedToken._id).select("-password");// now we are giving a query to the database to find the user
        //console.log(user)

        if(!user){// if there is no user with the above credentials then throw an error
            throw new ApiError(401, "Invalid accessToken")
        }
    
        req.user = user;
        //console.log(req.user);
        //console.log("this is req.user : ", req.user)
        next()
    } catch (error) {
        //console.log(error);
        throw new ApiError(401, "Invalid access token")
    }
})