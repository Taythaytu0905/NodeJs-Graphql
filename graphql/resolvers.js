const User = require("../models/user")
const Post = require("../models/post")
const bcrypt = require('bcryptjs')
const validator = require('validator')
const jwt = require("jsonwebtoken")
const {use} = require("express/lib/router");

module.exports = {
    createUser: async function ({userInput}, req) {
        const email = userInput.email
        const password = userInput.password
        const name = userInput.name
        const errors = []

        if (!validator.isEmail(email)) {
            errors.push({"message": "Email is invalid!"})
        }
        if (!validator.isEmpty(password) || !validator.isLength(password, {min: 5})) {
            errors.push({"message": "Password is invalid!"})
        }
        if (errors.length > 1) {
            const error = new Error("Data is invalid")
            error.code = 400
            error.data = errors
            throw error
        }

        const existingUser = await User.findOne({email: email})
        if (existingUser) {
            throw  new Error("User exists already!")
        }
        const hashedPw = await bcrypt.hash(password, 12)
        const user = new User({
            email: email,
            password: hashedPw,
            name: name,
        })
        const createdUser = await user.save()

        return {_id: createdUser._id.toString(), ...createdUser._doc}
    },

    login: async function ({email, password}, req) {
        const user = await User.findOne({email: email})
        if (!user) {
            const error = new Error("Don't have user!")
            error.code = 401
            throw  error
        }
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
            const error = new Error("Password is incorrect!")
            error.code = 401
            throw  error
        }
        const token = jwt.sign({
            userId: user._id.toString(),
            email: email
        }, "asdasdasgaserqw", {expiresIn: "1h"})
        return {
            userId: user._id.toString(),
            token: token
        }
    },

    createPost: async function ({postInput}, req) {
        const title = postInput.title
        const content = postInput.content
        const imageUrl = postInput.imageUrl

        const errors = []

        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }

        if (validator.isEmpty(title) || !validator.isLength(title, {min: 5})) {
            errors.push({"message": "Title is invalid!"})
        }
        if (validator.isEmpty(content) || !validator.isLength(content, {min: 5})) {
            errors.push({"message": "Content is invalid!"})
        }
        if (errors.length > 1) {
            const error = new Error("Data is invalid")
            error.code = 400
            error.data = errors
            throw error
        }
        const user = await User.findById(req.userId)
        const post = new Post(
            {
                title: title,
                content: content,
                imageUrl: imageUrl,
                creator: user
            }
        )
        const createdPost = await post.save()
        user.posts.push(createdPost)
        await user.save()
        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString(),
        }
    },
    posts: async function ({page}, req) {
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        if (!page) {
            page = 1
        }
        const perPage = 2
        const totalPosts = await Post.find().countDocuments()
        const posts = await Post.find().sort({
            createdAt: -1
        }).skip((page - 1) * perPage).limit(perPage).populate("creator")
        const formatPosts = posts.map(p => {
            return {
                ...p._doc,
                _id: p._id.toString(),
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
            }
        })
        return {
            posts: formatPosts,
            totalPosts: totalPosts,
        }
    },
    post: async function ({id}, req) {
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        const post = await Post.findById(id).populate("creator")
        if (!post) {
            const error = new Error("Not found post")
            error.code = 404
            throw error
        }
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        }
    },
    updatePost: async function ({id, postInput}, req) {
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        const post = await Post.findById(id).populate("creator")
        if (!post) {
            const error = new Error("Not found post")
            error.code = 404
            throw error
        }
        if (post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error("Authorized!")
            error.code = 403
            throw error
        }
        post.title = postInput.title
        post.content = postInput.content
        const updatePost = await post.save()
        return {
            ...updatePost._doc,
            _id: updatePost._id.toString(),
            createdAt: updatePost.createdAt.toISOString(),
            updatedAt: updatePost.updatedAt.toISOString(),
        }
    },
    deletePost: async function ({id}, req) {
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        const post = await Post.findById(id)
        if (!post) {
            const error = new Error("Not found post")
            error.code = 404
            throw error
        }
        if (post.creator.toString() !== req.userId.toString()) {
            const error = new Error("Authorized!")
            error.code = 403
            throw error
        }
        await Post.findByIdAndRemove(id)
        const user = User.findById(req.userId)
        user.posts.pull(id)
        await user.save()
        return true
    },
    user: async function (args, req) {
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        const user = await User.findById(req.userId)
        if (!user) {
            const error = new Error("Not found user")
            error.code = 404
            throw error
        }
        return {
            ...user._doc,
            _id: user._id.toString()
        }
    },
    updateStatus: async function ({status}, req) {
        // We can user variable on FE -> UpdateUserStatus: name is clear, don't change anything
        // mutation UpdateUserStatus($status: String!) {
        //     updateStatus(status: $status){
        //         status
        //     }
        // }
        if (!req.isAuth) {
            const error = new Error("No authenticated!")
            error.code = 401
            throw error
        }
        const user = await User.findById(req.userId)
        if (!user) {
            const error = new Error("Not found user")
            error.code = 404
            throw error
        }
        user.status = status
        await user.save()
        return {
            ...user._doc,
            _id: user._id.toString()
        }

    }

}


