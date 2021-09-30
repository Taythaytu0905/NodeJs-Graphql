const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const multer = require('multer')
const {graphqlHTTP} = require("express-graphql")
const cors = require('cors')

const graphSchema = require("./graphql/schema")
const graphResolver = require("./graphql/resolvers")
const auth = require("./middleware/auth")
const fs = require("fs")

const app = express()

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images');
    },
    filename: (req, file, cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
})

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

app.use(bodyParser.json())
app.use(
    multer({storage: fileStorage, fileFilter: fileFilter}).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')))

app.use(cors({
    origin: '*'
}))

app.use(auth)

app.use("/post_image", (req, res, next) => {
    if (!req.isAuth) {
        throw new Error("Not authentication!")
    }

    if (!req.file) {
        return res.status(200).json({"message": "No file provide!"})
    }
    if (req.body.oldPath) {
        clearImage(req.body.oldPath)
    }
    return res.status(201).json({"message": "File store", filePath: req.file.path})
})

app.use("/graphql", graphqlHTTP({
        schema: graphSchema,
        rootValue: graphResolver,
        graphiql: true,
        customFormatErrorFn(err) {
            if (!err.originalError) {
                return err
            }
            const data = err.originalError.data
            const mess = err.message || "An error occurred"
            const statusCode = err.originalError.code || 500
            return {
                message: mess,
                data: data,
                code: statusCode,
            }
        }
    }
))


mongoose
    .connect(
        'mongodb+srv://Nodejs:Doxike123@test.y0anm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    )
    .then(result => {
        app.listen(4000)
    })
    .catch(err => console.log(err))

const clearImage = filePath => {
    filePath = path.join(__dirname, "..", filePath)
    fs.unlink(filePath, err => console.log(err))
}
