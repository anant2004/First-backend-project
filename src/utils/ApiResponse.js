class ApiResponse{
    constructor(
        statuCode,
        data,
        message = "Success"
    ){
        this.statusCode = statuCode
        this.data = data
        this.message = message
        this.success = statuCode < 400
    }
}