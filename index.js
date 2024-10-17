const express = require('express'); //express কে import করছি 
const cors = require('cors');
require ('dotenv').config()
const app = express();
const port = process.env.PORT || 5000; //process.env এর মধ্যে PORT থাকলে সেটি ব্যাবহার করবে, নাহয় 5000 এ ওপেন করবে।


//middleware
app.use(cors());
app.use(express.json());