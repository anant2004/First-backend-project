import express from "express";
import cors from "cors"
import cookieParser from "cookie-parser";// to set and access the user cookies of user using server

const app = express();

app.use(cors(
    {origin: process.env.CORS_ORIGIN,
        credentials: true
    }
))

app.use(express.json({
    limit: "16kb" //setting limit to the size of json files
}))

app.use(express.urlencoded({// this middleware is to understand the data coming from url 
    extended: true,
    limit: "16kb"
}))

app.use(express.static(// this helps in storing media files/folders in our server
    "public"//this is the folder created in our project to store assets
))

app.use(cookieParser())

export {app}