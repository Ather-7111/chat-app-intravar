import {useEffect, useRef, useState} from "react";
import {getAllMessages} from "@/lib/actions/message";
import {IoMdSend, IoMdDownload} from "react-icons/io";
import {MdAttachment} from "react-icons/md";
import {getChat} from "@/lib/actions/chat";
import {FaFilePdf, FaFilePowerpoint, FaFileWord} from "react-icons/fa";
import {getAllAttachmentsUsingMsgIds} from "@/lib/actions/attachement";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

export default function SingleChatPage({selectedUser, chat, socket}) {
    const [inbox, setInbox] = useState([]);
    const [message, setMessage] = useState("");
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const chatHistoryRef = useRef(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState("");
    const [ext, setExt] = useState("");
    const [url, setUrl] = useState('')
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [messageId, setMessageId] = useState('')
    const [selectedImages, setSelectedImages] = useState([])


    const loggedInUserId = localStorage.getItem("userId");


    const fileTypes = [
        {
            extension: "pdf",
            icon: <FaFilePdf/>,
            background: "https://ja.nsommer.dk/img/pdf.jpg",
            title: "View PDF Attachment",
            filetype: "application/pdf",
        },
        {
            extension: "ppt",
            icon: <FaFilePowerpoint/>,
            background:
                "https://kayaconnect.org/pluginfile.php/383349/course/overviewfiles/powerpoint.png",
            title: "View PPT Attachment",
            filetype: "application/vnd.ms-powerpoint",
        },
        {
            extension: "doc",
            icon: <FaFileWord/>,
            background:
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTaaT53qepmWven1TGX8jrjQxnmwcm4ynllyQ&s",
            title: "View DOC Attachment",
            filetype: "application/msword",
        },
    ];

    useEffect(() => {
        if (socket && chat && chat.id) {
            socket.emit("joinRoom", chat.id);
            console.log("chat id available", chat.id);

            const isCurrentUser = message?.senderId === loggedInUserId
            console.log("Current user:", isCurrentUser)


            // Handle incoming messages from socket
            socket.on("message", (message) => {
                console.log("Message from socket:", message);

                // Check if message has attachments
                if (Array.isArray(message.attachments)) {
                    console.log("multiple attachment message-->", message);

                    // Create a new message object with all attachments
                    const messageWithAttachments = {
                        ...message,
                        attachments: message.attachments
                    };
                    setInbox((prevInbox) => [...prevInbox, messageWithAttachments]);

                } else if (message.attachment || message.attachmentUrl) {
                    console.log("single attachment message-->", message);

                    // Handle single attachment
                    const singleAttachment = {
                        ...message,
                        attachments: [message.attachment || message.attachmentUrl]
                    };

                    setInbox((prevInbox) => [...prevInbox, singleAttachment]);
                } else {
                    // Handle regular text message
                    setInbox((prevInbox) => [...prevInbox, message]);
                }
            });

            // Add the sender's message to the inbox immediately
            if (chat.currentMessage) {
                setInbox((prevInbox) => [...prevInbox, chat.currentMessage]);
            }

            loadMessages();

            return () => {
                socket.off("message");
            };
        }
    }, [chat, socket]);

    useEffect(() => {
        // Scroll to the bottom whenever inbox updates
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [inbox]);

    const loadMessages = async () => {
        try {
            const chat = await getChat(loggedInUserId, selectedUser.id);

            const allMessages = await getAllMessages(
                loggedInUserId,
                selectedUser.id,
                chat.id
            );

            console.log("All messages without attachments --->", allMessages);

            // Extract message IDs for attachment messages
            const messageIds = allMessages
                .filter((message) => !message.text)
                .map((message) => message.id);

            // console.log("MsgIds-->", messageIds);

            // Fetch attachments
            const attachments = await getAllAttachmentsUsingMsgIds(messageIds)
            // console.log("attachments-->", attachments);

            // Combine messages and attachments
            const combinedMessages = allMessages.map((message) => {
                const attachmentGroup = attachments.filter(
                    (att) => att.messageId === message.id
                );
                return {
                    ...message,
                    attachments: attachmentGroup,
                };
            });


            console.log(
                "Combined messages -->",
                combinedMessages.length,
                combinedMessages
            );
            setInbox(combinedMessages);

            // Scroll to the bottom when messages are loaded
            if (chatHistoryRef.current) {
                chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
            }
        } catch (error) {
            console.error("Failed to load messages:", error);
        }
    };

    const handleFileUpload = (event) => {
        const selectedFiles = event.target.files;
        const previews = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            previews.push(URL.createObjectURL(file));
        }

        setFile(selectedFiles);
        setFilePreview(previews);
    };

    const handleSendMessage = async (event) => {
        event.preventDefault();

        if (!message.trim() && (!file || file.length === 0)) {
            return;
        }

        const newMessages = [];

        if (file && file.length > 0) {
            for (let i = 0; i < file.length; i++) {
                const currentFile = file[i];
                const readFile = (file) => {
                    return new Promise((resolve, reject) => {
                        const fileReader = new FileReader();
                        fileReader.onloadend = () => {
                            const attachmentUrl = fileReader.result;
                            const newMessage = {
                                filetype: file.type,
                                senderId: loggedInUserId,
                                receiverId: selectedUser.id,
                                text: message,
                                createdAt: new Date().toISOString(),
                                chatId: chat.id,
                                attachmentUrl,
                            };
                            resolve(newMessage);
                        };
                        fileReader.onerror = reject;
                        fileReader.readAsDataURL(file);
                    });
                };

                try {
                    const newMessage = await readFile(currentFile);
                    newMessages.push(newMessage);
                    setInbox((prevInbox) => [...prevInbox, ...newMessages]);
                } catch (error) {
                    console.error("Error reading file:", error);
                }
            }
            setMessage("");
            setFile(null);
            setUrl(message?.attachmentUrl || message);
            setFilePreview(null);


            if (newMessages.length > 0) {
                socket.emit("message", newMessages);
            }
        } else {
            const newMessage = {
                filetype: null,
                senderId: loggedInUserId,
                receiverId: selectedUser.id,
                text: message,
                createdAt: new Date().toISOString(),
                chatId: chat.id,
                attachmentUrl: null,
            };

            setInbox((prevInbox) => [...prevInbox, newMessage]);
            setMessage("");
            setFile(null);
            setFilePreview(null);
            setUrl(message?.attachmentUrl);

            socket.emit("message", newMessage);
        }
    };

    useEffect(() => {
        // console.log("file extension --------->", ext);
        console.log("inbox-->", inbox);
        // console.log("FilePreview", filePreview)
        // console.log("file", file)

    }, [inbox, url, selectedImage, lightboxOpen, selectedImages, file, filePreview]);

    function formatDate(dateString) {
        const date = new Date(dateString);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        const strMinutes = minutes < 10 ? "0" + minutes : minutes;
        return `${hours}:${strMinutes} ${ampm}`;
    }

    // Function to check if a file is an image
    const isImageFile = (url) => {
        return /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(url);
    };


    const handleImageClick = (attachment, index, mId) => {
        setLightboxOpen(true);
        setMessageId(mId);
        const filteredImages = inbox.find((message) => message.id === mId).attachments;
        console.log("filteredImages", filteredImages)

        setSelectedImages(filteredImages);
        setSelectedImage(attachment?.url);
    }

    useEffect(() => {
        console.log("messageId--->", messageId);
    }, [messageId])

    // const attachmentPreview = fileTypes.map((fileType) => fileType.background)


    return (
        <div className="chat h-screen flex flex-col">
            <div className="chat-header clearfix">
                <div className="row">
                    <div className="col-lg-6">
                        <a href="#" data-toggle="modal" data-target="#view_info">
                            <img
                                src="https://bootdey.com/img/Content/avatar/avatar2.png"
                                alt="avatar"
                            />
                        </a>

                        <div className="chat-about">
                            <h6 className="m-b-0">{selectedUser.name}</h6>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className="chat-history flex-grow flex flex-col-reverse overflow-y-auto p-4"
                ref={chatHistoryRef}
            >
                <ul className="m-b-0">
                    {inbox.map((message, index) => {

                        // console.log("message -----", message)
                        const isSentByCurrentUser = message.senderId === loggedInUserId;
                        const isReceiver = message?.senderId !== loggedInUserId;

                        const containerClass = isReceiver
                            ? "flex justify-start mb-2"
                            : "flex justify-end mb-2";

                        const bubbleClass = isReceiver
                            ? "bg-gray-300 text-gray-900 rounded-lg p-2"
                            : "bg-blue-500 text-white rounded-lg p-2";

                        const messageClass = isReceiver
                            ? "flex flex-col items-start"
                            : "flex flex-col items-end";


                        const fileType = message.attachment
                            ? message.attachment.url.split(".").pop()
                            : "";
                        const fileTypeInfo = fileTypes.find(
                            (type) => type.extension === fileType
                        );

                        const images = message.attachments
                            ? message.attachments.map((attachment) => ({
                                src: attachment.url,
                                alt: 'attachment',
                            }))
                            : message.attachmentUrl
                                ? [
                                    {
                                        src: message.attachmentUrl,
                                        alt: 'attachment',
                                    },
                                ]
                                : [];


                        return (
                            <li className={containerClass} key={index}>
                                <div className={messageClass}>

                                    {/* For text */}
                                    {message?.text && message?.text !== "" ? (
                                        <div className={bubbleClass}>
                                            <div className="message-data">
                                                <span className="message-data-time">
                                                    {formatDate(message.createdAt)}
                                                </span>
                                            </div>
                                            {message.text}
                                        </div>
                                    ) : (
                                        <div>
                                            {message?.attachments && (
                                                <div className="flex flex-wrap w-[486px]">
                                                    {message?.attachments && message?.attachments?.length >= 1 ? (
                                                        message.attachments.map((attachment) => {
                                                            return (
                                                                <>
                                                                    <img src={attachment?.url}
                                                                         className="w-[240px] h-[200px] rounded-lg cursor-pointer"/>
                                                                </>
                                                            )
                                                        })
                                                    ) : (
                                                        <div>
                                                            <img src={message.attachmentUrl}
                                                                 className="w-[240px] h-[200px] rounded-lg cursor-pointer"/>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                            }
                                        </div>
                                    )}


                                    <small className="flex justify-end mt-3">
                                        {formatDate(message.createdAt || "abc")}
                                    </small>
                                </div>
                            </li>
                        )
                            ;
                    })}
                </ul>
            </div>


            {/---- LightBox modal ----------/}
            {lightboxOpen && (
                <Lightbox
                    open={lightboxOpen}
                    close={() => setLightboxOpen(false)}
                    slides={selectedImages.map((image) => ({
                        src: image.url,
                    }))}
                />
            )}

            {/--------------------------------------/}


            {/* For images preview before sending */}

            {filePreview && (
                <div className="p-4 flex flex-wrap">
                    {filePreview.map((preview, index) => (
                        <img
                            key={index}
                            src={preview}
                            alt={''}
                            className="w-12 h-12 object-cover mr-1"
                        />
                    ))}
                </div>
            )}
            <div className="chat-message clearfix">
                <div className="input-group mb-0 border border-gray-400 flex">
                    <form
                        onSubmit={handleSendMessage}
                        className="flex justify-center items-center w-full px-4"
                    >
                        <div className="flex justify-center items-center text-3xl">
                            <button type="submit">
                                <IoMdSend/>
                            </button>
                        </div>

                        <input
                            onChange={(e) => setMessage(e.target.value)}
                            value={message}
                            name="message"
                            className="flex-grow p-5 outline-none resize-none"
                            placeholder="Enter text here..."
                        />
                        <label htmlFor="file">
                            <MdAttachment className="text-3xl cursor-pointer"/>
                        </label>
                        <input
                            type="file"
                            id="file"
                            multiple={true}
                            hidden
                            onChange={handleFileUpload}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}