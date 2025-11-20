require('dotenv').config();
import emailjs from '@emailjs/nodejs';

interface EmailOptions {
    email: string;
    subject: string;
    template: string;
    data: { [key: string]: any };
}

const sendMail = async (options: EmailOptions): Promise<void> => {
    const { email, subject, template, data } = options;

    // Prepare template parameters for EmailJS
    const templateParams = {
        to_email: email,
        subject: subject,
        user_name: data.user?.name || '',
        activation_code: data.activationCode || '',
        reset_code: data.resetCode || '',
        from_name: 'Online Assessment System',
    };

    try {
        // Send email using EmailJS Node.js SDK
        const response = await emailjs.send(
            process.env.EMAILJS_SERVICE_ID || '',
            process.env.templateId || '',
            templateParams,
            {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY,
            }
        );

        console.log('Email sent successfully via EmailJS:', response);
    } catch (error: any) {
        console.error('EmailJS Error:', error.text || error.message);
        throw new Error(`Failed to send email: ${error.text || error.message}`);
    }
};

export default sendMail;