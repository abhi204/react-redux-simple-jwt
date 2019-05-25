"use strict";

exports.__esModule = true;

var cookieHelper = require('./helpers/CookieHelper');
var axios = require('axios');

var CreateJwtMiddleware = ( configs ) => {
    let refresh_endpoint = configs.refresh_endpoint;

    // Return The JWT Middleware
    return (store) => (next) => (action) => {
        let META = action.meta || {};
        let headers = META.headers || {};

        if(META.type !== 'api')
            return next(action);

        let refreshToken = cookieHelper.getCookie('refresh');
        if(!refreshToken)
            return next({
                type: configs.LOGIN_REDIRECT_TYPE, //makes sure the user redirects to login page
                payload: action.payload
            });

        let accessToken = cookieHelper.getCookie('access');
        if(!accessToken)
            return next((dispatch) => {
                    return axios.post(refresh_endpoint, { refresh: refreshToken })
                            .then( ({data}) => {
                                if(data.access){
                                    setCookie('access', data.access, configs.accessToken_expire_time)
                                    dispatch(action)
                                }
                                else
                                    dispatch({type: configs.LOGIN_FAILED_TYPE})
                            })
                            .catch( error => dispatch({ type: configs.LOGIN_FAILED_TYPE, payload: error }))
                }
            )
        
        let request = axios({ 
            method: META.method,
            url: META.url,
            data: META.data,
            headers: { 'Authorization': `Bearer ${accessToken}`, ...headers }
        })

        // response handled by then function
        if(typeof(META.then) === "function")
            return next((dispatch) => {
                    if(action.loadingType)
                        dispatch({type: action.loadingType})
                    return request.then( response => { META.then(response, true); dispatch({type: "simple-JWT Middleware executed then function"}) } )
                                .catch( error => { META.then(error, false); dispatch({type: "simple-JWT Middleware executed then function (with Failed Response)"}) } )
                    }
            )
        // response data passed to reducers
        else
            return next((dispatch) => {
                    if(action.loadingType)
                        dispatch({type: action.loadingType})
                    return request.then( ({data}) => next({ type: action.type, payload: data }) )
                                    .catch( error => dispatch({ type: action.failedType, payload: error }))
                }
            )
    }
}

exports.CreateJwtMiddleware = CreateJwtMiddleware;