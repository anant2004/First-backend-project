//here we are also using the flag "next" so that we can alsp use middlewares whenever a check from the middleware returns true it makes the flag also true
// this is the try/catch format same thing can be done using promises this is using .then(), .catch()
/*const asyncHandler = (fn) => async(req, res, next) => { // this is a higher order function which can accept other function as an argument, return function, or both.
    try{
        await fn(req, res, next)
    }catch(error){
        res.status(error.code || 500).json({// we send a status with the error code or if it is not available we send error 500
            success: false,
            message: error.message
        })
    }
}*/ 

// this is the approach using promises
const asyncHandler = (requestHandler) => {
    (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch(
            error => next(error)
        )
    }
}

export {asyncHandler}

