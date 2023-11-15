from flask import render_template, url_for

class Messenger():

    @staticmethod
    def init_app(app):
        Messenger.messages = {
            "registration_success": {
                "type": "success",
                "title": "Registration Success",
                "heading": "Registration Succeeded!",
                "message": "Thank you for registering! A confirmation email has been sent to your inbox. Please check your email and click the confirmation link to activate your account."
            },
            "confirmation_email_resent": {
                "type": "success",
                "title": "Email Resent",
                "heading": "Email Resent Successfully!",
                "message": "We've resent the confirmation email to your inbox. Please check your email and click the confirmation link to activate your account."
            },
            "confirmation_email_resend_failure": {
                "type": "failure",
                "title": "Invalid user",
                "heading": "Invalid user",
                "message": "User is invalid or is already confirmed."
            },
            "confirmation_success": {
                "type": "success",
                "title": "Confirmation Success",
                "heading": "Congratulations!",
                "message": "Your email has been successfully confirmed. You have completed the registration process and can now log in."
            },
            "confirmation_failure": {
                "type": "failure",
                "title": "Confirmation Failure",
                "heading": "Confirmation Attempt Failed",
                "message": "The token was invalid or expired. Please double-check the link or request another token <a href='{{ url_for('userkit.request_confirmation_email') }}'>here</a>."
            },
            "request_password_reset_email_sent": {
                "type": "success",
                "title": "Password Reset Email Sent",
                "heading": "Password Reset Email Sent",
                "message": "If your provided email is associated with us, instructions for resetting your password have been sent. Check your inbox and follow the provided link to reset your password."
            },
            "password_reset_failure": {
                "type": "failure",
                "title": "Password Reset Failure",
                "heading": "Password Reset Failed",
                "message": "The token was invalid or expired. Please double-check the link or request another token <a href='{{ url_for('userkit.request_password_reset_email') }}'>here</a>."
            },
            "password_change_success": {
                "type": "success",
                "title": "Password Change Success",
                "heading": "Password Changed Successfully",
                "message": "Your password has been updated successfully. You can now log in securely with your new password."
            },
            "logout": {
                "type": "success",
                "title": "Logout Successful",
                "heading": "Goodbye for Now!",
                "message": "You have logged out."
            },
            "feedback_success": {
                "type": "success",
                "title": "Feedback Received",
                "heading": "Thank You for Your Feedback",
                "message": "We've received your feedback. It will be reviewed as we work towards improving our platform. If you have any further comments or questions, feel free to get in touch."
            }
        }

    @staticmethod
    def render_message_template(message):
        """Returns html for a short message to the user.
        """
        return render_template("message.html", type=message["type"], title=message["title"], heading=message["heading"], message=message["message"])