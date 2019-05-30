"use strict";

exports.__esModule = true;

var cookieHelper = require('./helpers/CookieHelper');
var axios = require('axios');

var CreateJwtMiddleware = ( configs ) => {
    let refresh_endpoint = configs.refreshEndpoint;

    // Return The JWT Middleware
    return (store) => (next) => (action) => {
        let META = action.request;

        if(META === undefined || META === null)
            return next(action);
        
        let metaHeaders = META.headers || {};

        let refreshToken = cookieHelper.getCookie('refresh');
        if(!refreshToken)
            return next({
                type: "authorization failed", //makes sure the user redirects to login page
                payload: "refresh token unavailable"
            });

        let accessToken = cookieHelper.getCookie('access');
        if(!accessToken)
            return next((dispatch) => {
                    return axios.post(refresh_endpoint, { refresh: refreshToken })
                            .then( ({data}) => {
                                if(data.access){
                                    setCookie('access', data.access, configs.accessTokenExpireTime)
                                    dispatch(action)
                                }
                                else
                                    dispatch({
                                        type: "authorization failed",
                                        payload: "failed to fetch new access token"
                                    })
                            })
                            .catch( error => dispatch({ 
                                type: "authorization failed",
                                payload: "failed to fetch new access token"
                            }))
                }
            )
        
        let request = axios({ 
            method: META.method,
            url: META.url,
            data: META.data,
            headers: { 'Authorization': `Bearer ${accessToken}`, ...metaHeaders }
        })

        // response handled by then function
        if(typeof(action.responseHandler) === "function")
            return next((dispatch) => {
                    if(action.loadingType)
                        dispatch({type: action.loadingType})
                    return request.then( response => { 
                                            META.then(response, true);
                                            dispatch({
                                                type: "simple-JWT Middleware executed then function"}) 
                                            }
                                        )
                                .catch( error => { META.then(error, false); dispatch({type: "simple-JWT Middleware executed then function (with Failed Response)"}) } )
                    }
            )
        // response data passed to reducers
        else
            return next((dispatch) => {
                    if(action.loadingType)
                        dispatch({type: action.loadingType})
                    return request.then( ({data}) => next({ type: action.successType, payload: data }) )
                                    .catch( error => dispatch({ type: action.failedType, payload: error }))
                }
            )
    }
}

exports.CreateJwtMiddleware = CreateJwtMiddleware;
